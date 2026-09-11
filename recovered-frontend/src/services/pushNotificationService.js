import { supabase } from '../lib/supabase';
import { offlineQueueService } from './offlineQueueService';
import { addStoredNotification,  } from './supplyNotificationService';

// ─── VAPID-less push: uses browser Notification API + SW showNotification ──────
// Server-side triggers are handled by Supabase Edge Functions.
// This service manages: permission, offline queue, and in-app + browser push
// for huddle submissions, order approvals, and time-sensitive alerts.

const PUSH_PREFS_KEY = 'nudental_push_prefs';
const PUSH_QUEUE_KEY = 'nudental_push_offline_queue';
const MAX_QUEUE = 100;

// ─── Default push preferences ────────────────────────────────────────────────
export const DEFAULT_PUSH_PREFS = {
  huddle_submitted: true,
  order_submitted: true,
  order_approved: true,
  order_rejected: true,
  low_stock_alert: true,
  time_sensitive: true,
};

// ─── Preference helpers ───────────────────────────────────────────────────────
export function getPushPrefs() {
  try {
    const stored = localStorage.getItem(PUSH_PREFS_KEY);
    return stored ? { ...DEFAULT_PUSH_PREFS, ...JSON.parse(stored) } : { ...DEFAULT_PUSH_PREFS };
  } catch (_) {
    return { ...DEFAULT_PUSH_PREFS };
  }
}

export function savePushPrefs(prefs) {
  try {
    localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
}

export function isPushPrefEnabled(key) {
  return getPushPrefs()?.[key] ?? true;
}

// ─── Permission helpers ───────────────────────────────────────────────────────
export function getPushPermissionState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestPushPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  const result = await Notification.requestPermission();
  return result;
}

// ─── Service Worker registration helper ──────────────────────────────────────
export async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker?.ready;
    return reg;
  } catch (_) {
    return null;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────────
function _generateId() {
  return `push_${Date.now()}_${Math.random()?.toString(36)?.slice(2, 8)}`;
}

// In-memory listeners for new push notifications
const _pushListeners = new Set();

export function onNewPushNotification(fn) {
  _pushListeners?.add(fn);
  return () => _pushListeners?.delete(fn);
}

function _broadcastPush(notif) {
  _pushListeners?.forEach(fn => { try { fn(notif); } catch (_) {} });
}

// ─── Offline push queue (localStorage fallback) ──────────────────────────────
function _getOfflinePushQueue() {
  try {
    return JSON.parse(localStorage.getItem(PUSH_QUEUE_KEY) || '[]');
  } catch (_) { return []; }
}

function _saveOfflinePushQueue(queue) {
  try {
    localStorage.setItem(PUSH_QUEUE_KEY, JSON.stringify(queue?.slice(0, MAX_QUEUE)));
  } catch (_) {}
}

function _enqueueOfflinePush(notification) {
  const queue = _getOfflinePushQueue();
  queue?.unshift({ ...notification, queued_at: new Date()?.toISOString() });
  _saveOfflinePushQueue(queue);
}

export function getPendingPushQueue() {
  return _getOfflinePushQueue();
}

export function clearPushQueue() {
  _saveOfflinePushQueue([]);
}

// ─── Core: fire a push notification (with offline fallback) ──────────────────
/**
 * Fire a push notification. If offline, queues it for delivery when back online.
 * If online, fires immediately via browser Notification API + SW showNotification.
 */
export async function firePushNotification(opts) {
  const { title, body, tag, deepLink = '/', type, icon = '/favicon.ico', requireInteraction = false } = opts;

  // Check preference
  if (type && !isPushPrefEnabled(type)) return;

  // Build stored notification
  const notif = {
    id: _generateId(),
    type: type || 'general',
    title,
    body,
    deepLink,
    tag: tag || `nudental-${type || 'alert'}-${Date.now()}`,
    timestamp: new Date()?.toISOString(),
    read: false,
  };

  // Store in-app notification list (shared with supply bell)
  addStoredNotification(notif);
  _broadcastPush(notif);

  // If offline: queue for later delivery
  if (!offlineQueueService?.isOnline()) {
    _enqueueOfflinePush({ title, body, tag: notif?.tag, deepLink, icon, requireInteraction, type });
    return;
  }

  // If online: fire browser notification
  await _deliverBrowserPush({ title, body, tag: notif?.tag, deepLink, icon, requireInteraction });
}

async function _deliverBrowserPush({ title, body, tag, deepLink, icon, requireInteraction }) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  // Try SW showNotification first (works when app is backgrounded)
  const reg = await getServiceWorkerRegistration();
  if (reg && reg?.showNotification) {
    try {
      await reg?.showNotification(title, {
        body,
        icon,
        badge: '/favicon.ico',
        tag,
        data: { deepLink },
        requireInteraction,
        silent: false,
      });
      return;
    } catch (_) {}
  }

  // Fallback: direct Notification API
  try {
    const n = new Notification(title, { body, icon, tag, requireInteraction, silent: false });
    n.onclick = () => {
      window.focus();
      if (deepLink) window.location.href = deepLink;
    };
  } catch (err) {
    console.warn('[PushNotif] Browser notification failed:', err);
  }
}

// ─── Flush offline push queue when back online ───────────────────────────────
export async function flushOfflinePushQueue() {
  const queue = _getOfflinePushQueue();
  if (!queue?.length) return;
  clearPushQueue();
  for (const item of queue) {
    await _deliverBrowserPush(item);
  }
}

// Wire up online event to flush queue
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setTimeout(() => flushOfflinePushQueue(), 1500);
  });
}

// ─── Huddle notification helpers ─────────────────────────────────────────────

export async function notifyHuddleSubmitted({ officeName, huddleDate, submittedBy, huddleId }) {
  const dateLabel = huddleDate
    ? new Date(huddleDate)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'today';
  await firePushNotification({
    title: '📋 Morning Huddle Submitted',
    body: `${officeName || 'Office'} huddle for ${dateLabel} has been submitted${submittedBy ? ` by ${submittedBy}` : ''}.`,
    tag: `huddle-submitted-${huddleId || Date.now()}`,
    deepLink: '/daily-morning-huddle',
    type: 'huddle_submitted',
  });
}

export async function notifyHuddleUnlocked({ officeName, huddleDate, unlockedBy }) {
  const dateLabel = huddleDate
    ? new Date(huddleDate)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'today';
  await firePushNotification({
    title: '🔓 Huddle Unlocked for Editing',
    body: `${officeName || 'Office'} huddle for ${dateLabel} was unlocked${unlockedBy ? ` by ${unlockedBy}` : ''}.`,
    tag: `huddle-unlocked-${Date.now()}`,
    deepLink: '/daily-morning-huddle',
    type: 'huddle_submitted',
    requireInteraction: false,
  });
}

// ─── Order / supply request notification helpers ──────────────────────────────

export async function notifyOrderSubmitted({ officeName, requestType, priority, orderId }) {
  const isUrgent = ['Urgent', 'Critical']?.includes(priority);
  await firePushNotification({
    title: isUrgent ? `🚨 ${priority} Order Request` : '📦 New Order Request',
    body: `${officeName || 'An office'} submitted a ${requestType || ''} order request${priority && priority !== 'Normal' ? ` (${priority})` : ''}.`,
    tag: `order-submitted-${orderId || Date.now()}`,
    deepLink: '/rcm-dashboard',
    type: 'order_submitted',
    requireInteraction: isUrgent,
  });
}

export async function notifyOrderStatusChanged({ officeName, requestType, newStatus, orderId }) {
  const isApproved = newStatus === 'Fulfilled' || newStatus === 'Acknowledged';
  const isRejected = newStatus === 'Rejected';
  const emoji = isApproved ? '✅' : isRejected ? '❌' : '📋';
  const type = isRejected ? 'order_rejected' : 'order_approved';

  await firePushNotification({
    title: `${emoji} Order ${newStatus}`,
    body: `Your ${requestType || ''} order request from ${officeName || 'your office'} has been ${newStatus?.toLowerCase()}.`,
    tag: `order-status-${orderId || Date.now()}`,
    deepLink: '/rcm-dashboard',
    type,
    requireInteraction: isRejected,
  });
}

// ─── Time-sensitive / pace alert helper ──────────────────────────────────────

export async function notifyTimeSensitiveAlert({ title, body, deepLink = '/' }) {
  await firePushNotification({
    title,
    body,
    tag: `time-sensitive-${Date.now()}`,
    deepLink,
    type: 'time_sensitive',
    requireInteraction: true,
  });
}

// ─── Supabase Realtime: subscribe to order_requests status changes ────────────
let _orderChannel = null;

export function subscribeOrderNotifications(userProfile) {
  if (!userProfile?.id || !supabase) return;
  if (_orderChannel) {
    try { supabase?.removeChannel(_orderChannel); } catch (_) {}
    _orderChannel = null;
  }

  const isRCMOrAdmin = ['regional_clinical_manager', 'super_admin', 'admin']?.includes(userProfile?.role);

  _orderChannel = supabase?.channel('order-request-push-notifs')?.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'order_requests' },
      (payload) => {
        if (!isRCMOrAdmin) return;
        const rec = payload?.new;
        notifyOrderSubmitted({
          officeName: rec?.office_name,
          requestType: rec?.request_type,
          priority: rec?.priority,
          orderId: rec?.id,
        });
      }
    )?.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'order_requests' },
      (payload) => {
        const rec = payload?.new;
        const old = payload?.old;
        if (rec?.req_status === old?.req_status) return;
        if (rec?.office_name === userProfile?.office_name || isRCMOrAdmin) {
          notifyOrderStatusChanged({
            officeName: rec?.office_name,
            requestType: rec?.request_type,
            newStatus: rec?.req_status,
            orderId: rec?.id,
          });
        }
      }
    )?.subscribe();

  return _orderChannel;
}

export function unsubscribeOrderNotifications() {
  if (_orderChannel) {
    try { supabase?.removeChannel(_orderChannel); } catch (_) {}
    _orderChannel = null;
  }
}

// ─── Supabase Realtime: subscribe to huddle status changes ───────────────────
let _huddleChannel = null;

export function subscribeHuddleNotifications(userProfile, offices = []) {
  if (!userProfile?.id || !supabase) return;
  if (_huddleChannel) {
    try { supabase?.removeChannel(_huddleChannel); } catch (_) {}
    _huddleChannel = null;
  }

  const isAdmin = ['super_admin', 'admin', 'regional_clinical_manager', 'office_manager']?.includes(userProfile?.role);

  _huddleChannel = supabase?.channel('huddle-push-notifs')?.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'huddles' },
      (payload) => {
        const rec = payload?.new;
        const old = payload?.old;
        if (rec?.status === old?.status) return;
        if (isAdmin && rec?.status === 'submitted') {
          const office = offices?.find(o => o?.id === rec?.office_id);
          notifyHuddleSubmitted({
            officeName: office?.name || rec?.office_id,
            huddleDate: rec?.huddle_date,
            submittedBy: rec?.submitted_by_name || '',
            huddleId: rec?.id,
          });
        }
      }
    )?.subscribe();

  return _huddleChannel;
}

export function unsubscribeHuddleNotifications() {
  if (_huddleChannel) {
    try { supabase?.removeChannel(_huddleChannel); } catch (_) {}
    _huddleChannel = null;
  }
}

export default {
  getPushPrefs,
  savePushPrefs,
  isPushPrefEnabled,
  getPushPermissionState,
  requestPushPermission,
  firePushNotification,
  flushOfflinePushQueue,
  getPendingPushQueue,
  notifyHuddleSubmitted,
  notifyHuddleUnlocked,
  notifyOrderSubmitted,
  notifyOrderStatusChanged,
  notifyTimeSensitiveAlert,
  subscribeOrderNotifications,
  unsubscribeOrderNotifications,
  subscribeHuddleNotifications,
  unsubscribeHuddleNotifications,
};
