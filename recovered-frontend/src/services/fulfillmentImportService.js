import { supabase } from '../lib/supabase';
import { dashboardEnvironment } from '../config/dashboardEnvironment';
import supplyRequestService from './supplyRequestService';

export const fulfillmentFileKey = async (file) => {
  const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const fulfillmentRowId = async (fileKey, rowIndex) => {
  if (!/^[a-f0-9]{64}$/.test(fileKey) || !Number.isSafeInteger(rowIndex) || rowIndex < 0) {
    throw new Error('Import identity is missing. Re-upload the file before importing.');
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(`nudental-qa-fulfillment-import-v1:${fileKey}:${rowIndex}`)));
  // UUID v8: stable within this import namespace; database primary key arbitrates retries.
  digest[6] = (digest[6] & 0x0f) | 0x80;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};

export const importFulfillmentRow = async (payload, fileKey, rowIndex) => {
  if (!dashboardEnvironment.isQa) {
    return { record: await supplyRequestService.createFulfillmentLog(payload), alreadyImported: false };
  }
  // This adapter is only for the existing unlinked historical-file import.
  if (['item_id', 'request_item_id', 'batch_id', 'urgent_request_id'].some(key => payload[key])) {
    throw new Error('Linked fulfillment records require their normal supply workflow.');
  }
  const id = await fulfillmentRowId(fileKey, rowIndex);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user?.id) throw new Error('Sign in before importing fulfillment records.');
  const { data, error } = await supabase.from('supply_fulfillment_logs')
    .insert({ ...payload, id, supplied_by: user.id }).select().single();
  if (!error) return { record: data, alreadyImported: false };
  if (error.code !== '23505') throw error;
  const existing = await supabase.from('supply_fulfillment_logs')
    .select('id, office_id, item_name').eq('id', id).single();
  if (existing.error || existing.data?.office_id !== payload.office_id || existing.data?.item_name !== payload.item_name) {
    throw new Error('The earlier import could not be verified. Refresh before retrying.');
  }
  return { record: existing.data, alreadyImported: true };
};
