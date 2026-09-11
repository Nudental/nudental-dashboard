import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'nudental_notifications';
const PERMISSION_KEY = 'nudental_notif_permission';
const MAX_STORED = 50;

// ─── Notification content maps ───────────────────────────────────────────────

const BATCH_STATUS_CONTENT = {
  approved: (batch) => ({
    title: '✅ Supply Request Approved',
    body: `Your ${formatMonth(batch?.request_month)} supply request for ${shortOffice(batch?.office_id)} has been approved.`,
  }),
  partially_fulfilled: (batch) => ({
    title: '📦 Supply Request Partially Fulfilled',
    body: `Part of your ${formatMonth(batch?.request_month)} supply request for ${shortOffice(batch?.office_id)} has been fulfilled.`,
  }),
  fulfilled: (batch) => ({
    title: '✅ Supply Request Fulfilled',
    body: `Your ${formatMonth(batch?.request_month)} supply request for ${shortOffice(batch?.office_id)} has been fully fulfilled.`,
  }),
  rejected: (batch) => ({
    title: '❌ Supply Request Rejected',
    body: `Your ${formatMonth(batch?.request_month)} supply request for ${shortOffice(batch?.office_id)} was rejected. Tap to view details.`,
  }),
  under_review: (batch) => ({
    title: '🔍 Request Under Review',
    body: `Your supply request is being reviewed by the Regional Clinical Manager.`,
  }),
  submitted: (batch) => ({
    title: '📋 New Monthly Request',
    body: `${shortOffice(batch?.office_id)} submitted their ${formatMonth(batch?.request_month)} supply request.`,
  }),
};

const URGENT_STATUS_CONTENT = {
  acknowledged: (req) => ({
    title: '👁 Urgent Request Acknowledged',
    body: `Your urgent request for ${itemName(req)} has been acknowledged.`,
  }),
  in_process: (req) => ({
    title: '⚙️ Urgent Request In Process',
    body: `Your urgent request for ${itemName(req)} is being processed.`,
  }),
  partially_fulfilled: (req) => ({
    title: '📦 Urgent Request Partially Fulfilled',
    body: `Part of your urgent request for ${itemName(req)} has been fulfilled.`,
  }),
  fulfilled: (req) => ({
    title: '✅ Urgent Request Fulfilled',
    body: `Your urgent request for ${itemName(req)} has been fulfilled.`,
  }),
  denied: (req) => ({
    title: '❌ Urgent Request Denied',
    body: `Your urgent request for ${itemName(req)} was denied. Tap to view details.`,
  }),
  submitted: (req) => ({
    title: '🚨 New Urgent Request',
    body: `${shortOffice(req?.office_id)} needs ${itemName(req)} urgently.`,
  }),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMonth(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr)?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch (_) { return dateStr?.slice(0, 7) || ''; }
}

function shortOffice(officeId) {
  if (!officeId) return 'your office';
  return officeId?.split(' ')?.pop() || officeId;
}

function itemName(req) {
  return req?.custom_item_name || req?.item_name || 'the requested item';
}

function generateId() {
  return `notif_${Date.now()}_${Math.random()?.toString(36)?.slice(2, 8)}`;
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

export function getStoredNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (_) { return []; }
}

function saveNotifications(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list?.slice(0, MAX_STORED)));
  } catch (_) {}
}

export function addStoredNotification(notif) {
  const existing = getStoredNotifications();
  const updated = [notif, ...existing]?.slice(0, MAX_STORED);
  saveNotifications(updated);
  return updated;
}

export function markStoredAsRead(id) {
  const list = getStoredNotifications()?.map(n => n?.id === id ? { ...n, read: true } : n);
  saveNotifications(list);
  return list;
}

export function markAllStoredAsRead() {
  const list = getStoredNotifications()?.map(n => ({ ...n, read: true }));
  saveNotifications(list);
  return list;
}

// ─── Browser Notification Permission ─────────────────────────────────────────

export function getPermissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  const result = await Notification.requestPermission();
  localStorage.setItem(PERMISSION_KEY, result);
  return result;
}

// ─── Fire browser notification ────────────────────────────────────────────────

function fireBrowserNotification({ title, body, tag, deepLink }) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag,
      requireInteraction: false,
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      if (deepLink) window.location.href = deepLink;
    };
  } catch (err) {
    console.warn('Browser notification failed:', err);
  }
}

// ─── In-app toast ─────────────────────────────────────────────────────────────

let _toastCallback = null;

export function registerToastCallback(fn) {
  _toastCallback = fn;
}

function fireToast(notif) {
  if (_toastCallback) _toastCallback(notif);
}

// ─── In-memory notification listeners ────────────────────────────────────────

const _listeners = new Set();

export function onNewNotification(fn) {
  _listeners?.add(fn);
  return () => _listeners?.delete(fn);
}

function broadcastNotification(notif) {
  _listeners?.forEach(fn => {
    try { fn(notif); } catch (_) {}
  });
}

// ─── Core: handle a status change event ──────────────────────────────────────

function handleBatchChange(record, userProfile) {
  const status = record?.batch_status;
  const isRCMOrAdmin = ['regional_clinical_manager', 'super_admin']?.includes(userProfile?.role);
  const isOwner = record?.office_id === userProfile?.office_id;

  // RCM/SuperAdmin: notify on new submissions from any office
  if (isRCMOrAdmin && status === 'submitted') {
    const content = BATCH_STATUS_CONTENT?.submitted?.(record);
    if (!content) return;
    const deepLink = `/inventory-dashboard?tab=monthly-supply&subtab=monthly-request&requestId=${record?.id}`;
    const notif = {
      id: generateId(),
      type: 'monthly_batch',
      recordId: record?.id,
      title: content?.title,
      body: content?.body,
      deepLink,
      officeId: record?.office_id,
      officeName: shortOffice(record?.office_id),
      timestamp: new Date()?.toISOString(),
      read: false,
    };
    addStoredNotification(notif);
    fireBrowserNotification({ title: content?.title, body: content?.body, tag: record?.id, deepLink });
    fireToast(notif);
    broadcastNotification(notif);
    return;
  }

  // Staff/OM/Admin: notify on status changes for their own office
  if (!isOwner) return;
  const statusesToNotify = ['under_review', 'approved', 'partially_fulfilled', 'fulfilled', 'rejected'];
  if (!statusesToNotify?.includes(status)) return;

  const contentFn = BATCH_STATUS_CONTENT?.[status];
  if (!contentFn) return;
  const content = contentFn(record);
  const deepLink = `/inventory-dashboard?tab=monthly-supply&subtab=monthly-request&requestId=${record?.id}`;
  const notif = {
    id: generateId(),
    type: 'monthly_batch',
    recordId: record?.id,
    title: content?.title,
    body: content?.body,
    deepLink,
    officeId: record?.office_id,
    officeName: shortOffice(record?.office_id),
    timestamp: new Date()?.toISOString(),
    read: false,
  };
  addStoredNotification(notif);
  fireBrowserNotification({ title: content?.title, body: content?.body, tag: record?.id, deepLink });
  fireToast(notif);
  broadcastNotification(notif);
}

function handleUrgentChange(record, userProfile) {
  const status = record?.urgent_status;
  const isRCMOrAdmin = ['regional_clinical_manager', 'super_admin']?.includes(userProfile?.role);
  const isOwner = record?.office_id === userProfile?.office_id;

  // RCM/SuperAdmin: notify on new urgent submissions
  if (isRCMOrAdmin && status === 'submitted') {
    const content = URGENT_STATUS_CONTENT?.submitted?.(record);
    if (!content) return;
    const deepLink = `/inventory-dashboard?tab=monthly-supply&subtab=urgent-request&requestId=${record?.id}`;
    const notif = {
      id: generateId(),
      type: 'urgent_request',
      recordId: record?.id,
      title: content?.title,
      body: content?.body,
      deepLink,
      officeId: record?.office_id,
      officeName: shortOffice(record?.office_id),
      timestamp: new Date()?.toISOString(),
      read: false,
    };
    addStoredNotification(notif);
    fireBrowserNotification({ title: content?.title, body: content?.body, tag: record?.id, deepLink });
    fireToast(notif);
    broadcastNotification(notif);
    return;
  }

  // Staff/OM/Admin: notify on status changes for their own office
  if (!isOwner) return;
  const statusesToNotify = ['acknowledged', 'in_process', 'partially_fulfilled', 'fulfilled', 'denied'];
  if (!statusesToNotify?.includes(status)) return;

  const contentFn = URGENT_STATUS_CONTENT?.[status];
  if (!contentFn) return;
  const content = contentFn(record);
  const deepLink = `/inventory-dashboard?tab=monthly-supply&subtab=urgent-request&requestId=${record?.id}`;
  const notif = {
    id: generateId(),
    type: 'urgent_request',
    recordId: record?.id,
    title: content?.title,
    body: content?.body,
    deepLink,
    officeId: record?.office_id,
    officeName: shortOffice(record?.office_id),
    timestamp: new Date()?.toISOString(),
    read: false,
  };
  addStoredNotification(notif);
  fireBrowserNotification({ title: content?.title, body: content?.body, tag: record?.id, deepLink });
  fireToast(notif);
  broadcastNotification(notif);
}

// ─── Subscription management ──────────────────────────────────────────────────

let _channel = null;

export function subscribeSupplyNotifications(userProfile) {
  if (!userProfile?.id || !supabase) return;
  // Clean up existing
  if (_channel) {
    try { supabase?.removeChannel(_channel); } catch (_) {}
    _channel = null;
  }

  _channel = supabase?.channel('supply-request-status')?.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'supply_request_batches' },
      (payload) => handleBatchChange(payload?.new, userProfile)
    )?.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'supply_request_batches' },
      (payload) => handleBatchChange(payload?.new, userProfile)
    )?.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'urgent_supply_requests' },
      (payload) => handleUrgentChange(payload?.new, userProfile)
    )?.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'urgent_supply_requests' },
      (payload) => handleUrgentChange(payload?.new, userProfile)
    )?.subscribe();

  return _channel;
}

export function unsubscribeSupplyNotifications() {
  if (_channel) {
    try { supabase?.removeChannel(_channel); } catch (_) {}
    _channel = null;
  }
}

export default {
  getStoredNotifications,
  addStoredNotification,
  markStoredAsRead,
  markAllStoredAsRead,
  getPermissionState,
  requestBrowserPermission,
  subscribeSupplyNotifications,
  unsubscribeSupplyNotifications,
  onNewNotification,
  registerToastCallback,
};
