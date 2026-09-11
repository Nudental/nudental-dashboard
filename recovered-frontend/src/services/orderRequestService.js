import { supabase } from '../lib/supabase';
import { notifyOrderSubmitted, notifyOrderStatusChanged } from './pushNotificationService';

const APP_URL = 'https://nudentalr1699.builtwithrocket.new';

// ── Constants ──────────────────────────────────────────────────────────────
export const ORDER_REQUEST_TYPES = ['Front Desk', 'Back Staff', 'Dental Supply'];
export const ORDER_PRIORITIES    = ['Normal', 'Important', 'High', 'Urgent', 'Critical'];
export const ORDER_STATUSES      = ['Pending', 'Acknowledged', 'In Progress', 'Fulfilled', 'Rejected'];
export const OFFICE_NAMES        = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

// ── Internal: call edge function directly from app layer ───────────────────────
async function _invokeNotification(record) {
  try {
    const { error } = await supabase?.functions?.invoke('order-request-notifications', {
      body: {
        id:                 record?.id,
        office_name:        record?.office_name,
        request_type:       record?.request_type,
        priority:           record?.priority,
        is_monthly_request: record?.is_monthly_request,
        submitted_by_name:  record?.submitted_by_name || 'Unknown',
        items:              record?.items || [],
        notes:              record?.notes || '',
        created_at:         record?.created_at,
      },
    });
    if (error) {
      console.warn('order-request-notifications edge function error:', error?.message);
    }
  } catch (err) {
    console.warn('Failed to invoke order-request-notifications:', err);
  }
}

// ── Submit a new order request ───────────────────────────────────────────────
/**
 * Submit a new order request and trigger SMS + Email notifications.
 *
 * Routing:
 *   Front Desk → Ny Velez (Ny@thenudental.com / +17328242033)
 *   Back Staff / Dental Supply → Maia Dolidze (Maia@thenudental.com / +19084943163)
 *
 * @param {Object} params
 * @param {'Front Desk'|'Back Staff'|'Dental Supply'} params.requestType
 * @param {string}  params.officeName
 * @param {string}  [params.priority]          - 'Normal'|'Important'|'High'|'Urgent'|'Critical'
 * @param {boolean} [params.isMonthlyRequest]
 * @param {Array}   [params.items]             - [{ item_name, requested_qty, unit_type, notes? }]
 * @param {string}  [params.notes]
 * @param {string}  [params.submittedByName]
 * @returns {Promise<Object>} The created order_request record
 */
export async function submitOrderRequest({
  requestType,
  officeName,
  priority = 'Normal',
  isMonthlyRequest = false,
  items = [],
  notes = '',
  submittedByName = '',
}) {
  const { data: { user } } = await supabase?.auth?.getUser();

  const payload = {
    office_name:         officeName,
    request_type:        requestType,
    priority,
    is_monthly_request:  isMonthlyRequest,
    submitted_by_id:     user?.id ?? null,
    submitted_by_name:   submittedByName || user?.user_metadata?.full_name || 'Unknown',
    items,
    notes:               notes || null,
  };

  const { data, error } = await supabase
    ?.from('order_requests')
    ?.insert(payload)
    ?.select()
    ?.single();

  if (error) throw error;

  // Invoke edge function from app layer
  await _invokeNotification(data);

  // Fire push notification for submitter + admins via Realtime
  await notifyOrderSubmitted({
    officeName: data?.office_name,
    requestType: data?.request_type,
    priority: data?.priority,
    orderId: data?.id,
  });

  return data;
}

// ── Fetch order requests ────────────────────────────────────────────────────────
/**
 * Fetch order requests (for admin/RCM review).
 * @param {Object} [filters]
 * @param {string} [filters.officeName]
 * @param {string} [filters.requestType]
 * @param {string} [filters.status]
 * @returns {Promise<Array>}
 */
export async function fetchOrderRequests({ officeName, requestType, status } = {}) {
  let query = supabase
    ?.from('order_requests')
    ?.select('*')
    ?.order('created_at', { ascending: false });

  if (officeName)   query = query?.eq('office_name', officeName);
  if (requestType)  query = query?.eq('request_type', requestType);
  if (status)       query = query?.eq('req_status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ── Update order request status ────────────────────────────────────────────────
/**
 * Update the status of an order request.
 * @param {string} id
 * @param {'Pending'|'Acknowledged'|'In Progress'|'Fulfilled'|'Rejected'} newStatus
 * @returns {Promise<Object>}
 */
export async function updateOrderRequestStatus(id, newStatus) {
  const { data, error } = await supabase
    ?.from('order_requests')
    ?.update({ req_status: newStatus })
    ?.eq('id', id)
    ?.select()
    ?.single();

  if (error) throw error;

  // Fire push notification for status change
  await notifyOrderStatusChanged({
    officeName: data?.office_name,
    requestType: data?.request_type,
    newStatus: data?.req_status,
    orderId: data?.id,
  });

  return data;
}
