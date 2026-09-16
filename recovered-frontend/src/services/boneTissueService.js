import { supabase } from '../lib/supabase';

const BUCKET = 'bone-tissue-attachments';

// ── Fetch inventory records with optional filters ──────────────────────────
export const fetchInventory = async (filters = {}) => {
  let query = supabase?.from('bone_tissue_inventory')?.select('*')?.order('procedure_date', { ascending: false })?.order('created_at', { ascending: false });

  if (filters?.officeId) query = query?.eq('office_id', filters?.officeId);
  if (filters?.providerId) query = query?.eq('provider_id', filters?.providerId);
  if (filters?.status) query = query?.eq('item_status', filters?.status);
  if (filters?.boneType) query = query?.eq('bone_tissue_type', filters?.boneType);
  if (filters?.staffAssistantId) query = query?.eq('staff_assistant_id', filters?.staffAssistantId);
  if (filters?.dateFrom) query = query?.gte('procedure_date', filters?.dateFrom);
  if (filters?.dateTo) query = query?.lte('procedure_date', filters?.dateTo);
  if (filters?.search) {
    query = query?.or(
      `patient_name.ilike.%${filters?.search}%,product_name.ilike.%${filters?.search}%,identification_number.ilike.%${filters?.search}%,provider_name.ilike.%${filters?.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ── Fetch summary counts ───────────────────────────────────────────────────
export const fetchSummary = async () => {
  const { data, error } = await supabase?.from('bone_tissue_inventory')?.select('item_status, office_name, expiration_date');
  if (error) throw error;

  const today = new Date();
  const in30 = new Date(today); in30?.setDate(today?.getDate() + 30);
  const in60 = new Date(today); in60?.setDate(today?.getDate() + 60);
  const in90 = new Date(today); in90?.setDate(today?.getDate() + 90);

  const summary = {
    inStock: 0,
    used: 0,
    expired: 0,
    wasted: 0,
    returned: 0,
    byLocation: {},
    expiring30: [],
    expiring60: [],
    expiring90: [],
  };

  (data || [])?.forEach(item => {
    const s = item?.item_status;
    if (s === 'In Stock') summary.inStock++;
    else if (s === 'Used') summary.used++;
    else if (s === 'Wasted') summary.wasted++;
    else if (s === 'Returned') summary.returned++;

    const loc = item?.office_name || 'Unknown';
    summary.byLocation[loc] = (summary?.byLocation?.[loc] || 0) + 1;

    if (item?.expiration_date) {
      const exp = new Date(item.expiration_date);
      if (exp < today) summary.expired++;
      else if (exp <= in30) summary?.expiring30?.push(item);
      else if (exp <= in60) summary?.expiring60?.push(item);
      else if (exp <= in90) summary?.expiring90?.push(item);
    }
  });

  return summary;
};

// ── Check duplicate identification number ─────────────────────────────────
export const checkDuplicateId = async (identificationNumber, excludeId = null) => {
  let query = supabase?.from('bone_tissue_inventory')?.select('id, product_name, procedure_date')?.eq('identification_number', identificationNumber);
  if (excludeId) query = query?.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ── Create record ──────────────────────────────────────────────────────────
const normalizeOptionalInventoryFields = (payload) => Object.fromEntries(
  Object.entries(payload).map(([key, value]) => [key,
    ['provider_id', 'staff_assistant_id', 'expiration_date'].includes(key) && value === '' ? null : value,
  ])
);

export const createInventoryRecord = async (payload) => {
  const { data, error } = await supabase?.from('bone_tissue_inventory')?.insert(normalizeOptionalInventoryFields(payload))?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Update record ──────────────────────────────────────────────────────────
export const updateInventoryRecord = async (id, payload) => {
  const { data, error } = await supabase?.from('bone_tissue_inventory')?.update({ ...normalizeOptionalInventoryFields(payload), updated_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Delete record ──────────────────────────────────────────────────────────
export const deleteInventoryRecord = async (id) => {
  const { error } = await supabase?.from('bone_tissue_inventory')?.delete()?.eq('id', id);
  if (error) throw error;
};

// ── Fetch audit log for a record ───────────────────────────────────────────
export const fetchAuditLog = async (recordId) => {
  const { data, error } = await supabase?.from('bone_tissue_audit_log')?.select('*')?.eq('record_id', recordId)?.order('changed_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ── Upload attachment ──────────────────────────────────────────────────────
export const uploadAttachment = async (file, userId) => {
  const ext = file?.name?.split('.')?.pop();
  const path = `${userId}/${Date.now()}-${Math.random()?.toString(36)?.slice(2)}.${ext}`;
  const { error } = await supabase?.storage?.from(BUCKET)?.upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
};

// ── Get signed URL for attachment ─────────────────────────────────────────
export const getAttachmentUrl = async (path) => {
  if (!path) return null;
  const { data, error } = await supabase?.storage?.from(BUCKET)?.createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
};

// ── Fetch providers ────────────────────────────────────────────────────────
export const fetchProviders = async () => {
  const { data, error } = await supabase?.from('providers')?.select('id, name, provider_type, office_id')?.eq('is_active', true)?.order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

// ── Fetch staff (user_profiles) ────────────────────────────────────────────
export const fetchStaff = async () => {
  const { data, error } = await supabase?.from('user_profiles')?.select('id, full_name, role, office_id')?.eq('is_active', true)?.order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
};

// ── Fetch offices ──────────────────────────────────────────────────────────
export const fetchOffices = async () => {
  const { data, error } = await supabase?.from('offices')?.select('id, name')?.eq('is_active', true)?.order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

// ── Fetch stock records ────────────────────────────────────────────────────
export const fetchStock = async (officeId = null) => {
  let query = supabase?.from('bone_tissue_stock')?.select('*')?.order('product_name', { ascending: true });
  if (officeId) query = query?.eq('office_id', officeId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ── Fetch stock for a specific identification_number + office ──────────────
export const fetchStockByItem = async (identificationNumber, officeId) => {
  if (!identificationNumber) return null;
  let query = supabase?.from('bone_tissue_stock')?.select('*')?.eq('identification_number', identificationNumber);
  if (officeId) query = query?.eq('office_id', officeId);
  const { data, error } = await query?.limit(1);
  if (error) throw error;
  return data?.[0] || null;
};

// ── Restock an item (Admin/Super Admin only) ───────────────────────────────
export const restockItem = async ({ stockId, productName, identificationNumber, officeId, officeName, quantityToAdd, userId, userName }) => {
  if (stockId) {
    // Update existing stock record
    const { data: existing } = await supabase?.from('bone_tissue_stock')?.select('current_stock, restock_history')?.eq('id', stockId)?.single();
    const newStock = (existing?.current_stock || 0) + quantityToAdd;
    const historyEntry = {
      added: quantityToAdd,
      new_total: newStock,
      restocked_by: userName,
      restocked_by_id: userId,
      restocked_at: new Date()?.toISOString(),
    };
    const updatedHistory = [...(existing?.restock_history || []), historyEntry];
    const { data, error } = await supabase?.from('bone_tissue_stock')?.update({
      current_stock: newStock,
      last_restocked_at: new Date()?.toISOString(),
      last_restocked_by: userId,
      last_restocked_by_name: userName || '',
      restock_history: updatedHistory,
      updated_at: new Date()?.toISOString(),
    })?.eq('id', stockId)?.select()?.single();
    if (error) throw error;
    return data;
  } else {
    // Create new stock record
    const historyEntry = {
      added: quantityToAdd,
      new_total: quantityToAdd,
      restocked_by: userName,
      restocked_by_id: userId,
      restocked_at: new Date()?.toISOString(),
    };
    const { data, error } = await supabase?.from('bone_tissue_stock')?.insert({
      product_name: productName || '',
      identification_number: identificationNumber || '',
      office_id: officeId || null,
      office_name: officeName || '',
      current_stock: quantityToAdd,
      restock_threshold: 2,
      last_restocked_at: new Date()?.toISOString(),
      last_restocked_by: userId,
      last_restocked_by_name: userName || '',
      restock_history: [historyEntry],
    })?.select()?.single();
    if (error) throw error;
    return data;
  }
};

// ── Fetch low stock items (stock <= threshold) ─────────────────────────────
export const fetchLowStockItems = async () => {
  const { data, error } = await supabase?.from('bone_tissue_stock')?.select('*')?.lte('current_stock', 2)?.order('current_stock', { ascending: true });
  if (error) throw error;
  return data || [];
};

// ── Deduct stock on frontend (guard before save) ───────────────────────────
export const deductStockForItem = async (identificationNumber, officeId) => {
  if (!identificationNumber) return null;
  const stockItem = await fetchStockByItem(identificationNumber, officeId);
  if (!stockItem) return null;
  const newStock = Math.max(0, (stockItem?.current_stock || 0) - 1);
  const { data, error } = await supabase?.from('bone_tissue_stock')?.update({
    current_stock: newStock,
    updated_at: new Date()?.toISOString(),
  })?.eq('id', stockItem?.id)?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Send low stock alert email via edge function ───────────────────────────
export const sendLowStockAlertEmail = async (recipientEmail, recipientName, lowStockItems) => {
  try {
    const { data: { session } } = await supabase?.auth?.getSession();
    const response = await fetch(
      `${import.meta.env?.VITE_SUPABASE_URL}/functions/v1/low-stock-alert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env?.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          items: lowStockItems?.map(item => ({
            product_name: item?.product_name,
            identification_number: item?.identification_number,
            office_name: item?.office_name,
            current_stock: item?.current_stock,
          })),
        }),
      }
    );
    return await response?.json();
  } catch (err) {
    console.error('Low stock email failed:', err);
    return null;
  }
};

// ── Fetch admin emails for low stock notifications ─────────────────────────
export const fetchAdminEmails = async () => {
  const { data, error } = await supabase?.from('user_profiles')?.select('id, full_name, email')?.in('role', ['admin', 'super_admin'])?.eq('is_active', true);
  if (error) throw error;
  return data || [];
};

// ── Lookup stock by identification number or lot number ────────────────────
export const lookupStockByLotOrId = async (identificationNumber, lotNumber) => {
  if (!identificationNumber && !lotNumber) return null;
  let query = supabase?.from('bone_tissue_stock')?.select('*');
  if (identificationNumber?.trim()) {
    query = query?.eq('identification_number', identificationNumber?.trim());
  } else if (lotNumber?.trim()) {
    query = query?.eq('lot_number', lotNumber?.trim());
  }
  const { data, error } = await query?.limit(1);
  if (error) throw error;
  return data?.[0] || null;
};

// ── Receive stock via scan (add qty, update lot/expiry) ────────────────────
export const receiveStockByScan = async ({
  identificationNumber,
  lotNumber,
  productName,
  boneType,
  officeId,
  officeName,
  expirationDate,
  quantityToAdd,
  userId,
  userName,
  notes,
  scanMethod,
}) => {
  // Try to find existing stock record
  const existing = await lookupStockByLotOrId(identificationNumber, lotNumber);

  const historyEntry = {
    action: 'received',
    quantity: quantityToAdd,
    scan_method: scanMethod || 'manual',
    by: userName,
    by_id: userId,
    at: new Date()?.toISOString(),
    notes: notes || '',
  };

  if (existing?.id) {
    const newStock = (existing?.current_stock || 0) + quantityToAdd;
    const updatedHistory = [...(existing?.restock_history || []), historyEntry];
    const { data, error } = await supabase?.from('bone_tissue_stock')?.update({
      current_stock: newStock,
      lot_number: lotNumber || existing?.lot_number || '',
      expiration_date: expirationDate || existing?.expiration_date || null,
      product_name: productName || existing?.product_name || '',
      bone_tissue_type: boneType || existing?.bone_tissue_type || '',
      last_restocked_at: new Date()?.toISOString(),
      last_restocked_by: userId,
      last_restocked_by_name: userName || '',
      restock_history: updatedHistory,
      updated_at: new Date()?.toISOString(),
    })?.eq('id', existing?.id)?.select()?.single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase?.from('bone_tissue_stock')?.insert({
      product_name: productName || '',
      identification_number: identificationNumber || '',
      lot_number: lotNumber || '',
      bone_tissue_type: boneType || '',
      office_id: officeId || null,
      office_name: officeName || '',
      current_stock: quantityToAdd,
      minimum_stock_level: 2,
      expiration_date: expirationDate || null,
      last_restocked_at: new Date()?.toISOString(),
      last_restocked_by: userId,
      last_restocked_by_name: userName || '',
      restock_history: [historyEntry],
    })?.select()?.single();
    if (error) throw error;
    return data;
  }
};

// ── Consume stock via scan (deduct qty + write usage log) ──────────────────
export const consumeStockByScan = async ({
  officeId,
  officeName,
  providerId,
  providerName,
  staffId,
  staffName,
  patientName,
  patientChartNumber,
  procedureDate,
  boneType,
  productName,
  identificationNumber,
  lotNumber,
  expirationDate,
  quantityUsed,
  scanMethod,
  notes,
  userId,
  userName,
}) => {
  // 1. Deduct from stock
  const stockItem = await lookupStockByLotOrId(identificationNumber, lotNumber);
  if (stockItem?.id) {
    const newStock = Math.max(0, (stockItem?.current_stock || 0) - quantityUsed);
    await supabase?.from('bone_tissue_stock')?.update({
      current_stock: newStock,
      updated_at: new Date()?.toISOString(),
    })?.eq('id', stockItem?.id);
  }

  // 2. Write usage log for lot traceability
  const { data, error } = await supabase?.from('bone_tissue_usage_log')?.insert({
    office_id: officeId || null,
    office_name: officeName || '',
    provider_id: providerId || null,
    provider_name: providerName || '',
    staff_id: staffId || null,
    staff_name: staffName || '',
    patient_name: patientName || '',
    patient_chart_number: patientChartNumber || '',
    procedure_date: procedureDate || new Date()?.toISOString()?.split('T')?.[0],
    bone_tissue_type: boneType || '',
    product_name: productName || '',
    identification_number: identificationNumber || '',
    lot_number: lotNumber || '',
    expiration_date: expirationDate || null,
    quantity_used: quantityUsed,
    scan_method: scanMethod || 'manual',
    notes: notes || '',
    created_by: userId || null,
    created_by_name: userName || '',
  })?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Fetch bone tissue usage logs ───────────────────────────────────────────
export const fetchBoneTissueUsageLogs = async (filters = {}) => {
  let query = supabase?.from('bone_tissue_usage_log')?.select('*')
    ?.order('procedure_date', { ascending: false })
    ?.order('created_at', { ascending: false });
  if (filters?.officeId) query = query?.eq('office_id', filters?.officeId);
  if (filters?.providerId) query = query?.eq('provider_id', filters?.providerId);
  if (filters?.dateFrom) query = query?.gte('procedure_date', filters?.dateFrom);
  if (filters?.dateTo) query = query?.lte('procedure_date', filters?.dateTo);
  if (filters?.search) {
    query = query?.or(
      `patient_name.ilike.%${filters?.search}%,lot_number.ilike.%${filters?.search}%,identification_number.ilike.%${filters?.search}%,product_name.ilike.%${filters?.search}%`
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};
