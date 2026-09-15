import { supabase } from '../lib/supabase';

const BUCKET = 'implant-attachments';

// ── Offices ────────────────────────────────────────────────────────────────
export const fetchOffices = async () => {
  const { data, error } = await supabase?.from('offices')?.select('id, name')?.eq('is_active', true)?.order('name');
  if (error) throw error;
  return data || [];
};

// ── Providers ──────────────────────────────────────────────────────────────
export const fetchProviders = async () => {
  const { data, error } = await supabase?.from('providers')?.select('id, name, office_id')?.eq('is_active', true)?.order('name');
  if (error) throw error;
  return data || [];
};

// ── Staff ──────────────────────────────────────────────────────────────────
export const fetchStaff = async () => {
  const { data, error } = await supabase?.from('user_profiles')?.select('id, full_name, role, office_id')?.eq('is_active', true)?.order('full_name');
  if (error) throw error;
  return data || [];
};

// ── Master Data: Companies ─────────────────────────────────────────────────
export const fetchCompanies = async (activeOnly = false) => {
  let q = supabase?.from('implant_companies')?.select('*')?.order('name');
  if (activeOnly) q = q?.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createCompany = async (name, userId) => {
  const { data, error } = await supabase?.from('implant_companies')?.insert({ name: name?.trim(), is_active: true, created_by: userId })?.select()?.single();
  if (error) throw error;
  return data;
};

export const updateCompany = async (id, updates) => {
  const { data, error } = await supabase?.from('implant_companies')?.update({ ...updates, updated_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Master Data: Systems ───────────────────────────────────────────────────
export const fetchSystems = async (companyId = null, activeOnly = false) => {
  let q = supabase?.from('implant_systems')?.select('*, implant_companies(name)')?.order('name');
  if (companyId) q = q?.eq('company_id', companyId);
  if (activeOnly) q = q?.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createSystem = async (name, companyId, userId) => {
  const { data, error } = await supabase?.from('implant_systems')?.insert({ name: name?.trim(), company_id: companyId, is_active: true, created_by: userId })?.select()?.single();
  if (error) throw error;
  return data;
};

export const updateSystem = async (id, updates) => {
  const { data, error } = await supabase?.from('implant_systems')?.update({ ...updates, updated_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Master Data: Platform Sizes ────────────────────────────────────────────
export const fetchPlatformSizes = async (activeOnly = false) => {
  let q = supabase?.from('implant_platform_sizes')?.select('*')?.order('name');
  if (activeOnly) q = q?.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createPlatformSize = async (name, userId) => {
  const { data, error } = await supabase?.from('implant_platform_sizes')?.insert({ name: name?.trim(), is_active: true, created_by: userId })?.select()?.single();
  if (error) throw error;
  return data;
};

export const updatePlatformSize = async (id, updates) => {
  const { data, error } = await supabase?.from('implant_platform_sizes')?.update({ ...updates, updated_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Master Data: Lengths ───────────────────────────────────────────────────
export const fetchLengths = async (activeOnly = false) => {
  let q = supabase?.from('implant_lengths')?.select('*')?.order('value_mm');
  if (activeOnly) q = q?.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createLength = async (label, valueMm, userId) => {
  const { data, error } = await supabase?.from('implant_lengths')?.insert({ label: label?.trim(), value_mm: valueMm || null, is_active: true, created_by: userId })?.select()?.single();
  if (error) throw error;
  return data;
};

export const updateLength = async (id, updates) => {
  const { data, error } = await supabase?.from('implant_lengths')?.update({ ...updates, updated_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Master Data: Diameters ─────────────────────────────────────────────────
export const fetchDiameters = async (activeOnly = false) => {
  let q = supabase?.from('implant_diameters')?.select('*')?.order('value_mm');
  if (activeOnly) q = q?.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createDiameter = async (label, valueMm, userId) => {
  const { data, error } = await supabase?.from('implant_diameters')?.insert({ label: label?.trim(), value_mm: valueMm || null, is_active: true, created_by: userId })?.select()?.single();
  if (error) throw error;
  return data;
};

export const updateDiameter = async (id, updates) => {
  const { data, error } = await supabase?.from('implant_diameters')?.update({ ...updates, updated_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  return data;
};

// ── Inventory ──────────────────────────────────────────────────────────────
export const fetchInventory = async (filters = {}) => {
  let q = supabase?.from('implant_inventory')?.select('*')?.order('created_at', { ascending: false });
  if (filters?.officeId) q = q?.eq('office_id', filters?.officeId);
  if (filters?.companyId) q = q?.eq('company_id', filters?.companyId);
  if (filters?.systemId) q = q?.eq('system_id', filters?.systemId);
  if (filters?.platformSizeId) q = q?.eq('platform_size_id', filters?.platformSizeId);
  if (filters?.lengthId) q = q?.eq('length_id', filters?.lengthId);
  if (filters?.diameterId) q = q?.eq('diameter_id', filters?.diameterId);
  if (filters?.status) q = q?.eq('item_status', filters?.status);
  if (filters?.lowStockOnly) q = q?.lte('quantity_in_stock', supabase?.raw ? 'minimum_stock_level' : 0);
  if (filters?.expirationFrom) q = q?.gte('expiration_date', filters?.expirationFrom);
  if (filters?.expirationTo) q = q?.lte('expiration_date', filters?.expirationTo);
  if (filters?.search) {
    q = q?.or(`identification_number.ilike.%${filters?.search}%,lot_number.ilike.%${filters?.search}%,sku_reference.ilike.%${filters?.search}%,company_name.ilike.%${filters?.search}%,system_name.ilike.%${filters?.search}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const fetchInventorySummary = async () => {
  const { data, error } = await supabase?.from('implant_inventory')?.select('item_status, office_name, expiration_date, quantity_in_stock, minimum_stock_level, company_name, platform_size_name, length_label');
  if (error) throw error;

  const today = new Date();
  const in30 = new Date(today); in30?.setDate(today?.getDate() + 30);
  const in60 = new Date(today); in60?.setDate(today?.getDate() + 60);
  const in90 = new Date(today); in90?.setDate(today?.getDate() + 90);
  const monthStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 1)).toISOString().slice(0, 10);
  const { count: usedCount, error: usageError } = await supabase?.from('implant_usage_logs')
    ?.select('id', { count: 'exact', head: true })?.eq('item_status', 'used')
    ?.gte('procedure_date', monthStart)?.lt('procedure_date', nextMonth);
  if (usageError) throw usageError;

  const summary = {
    totalInStock: 0,
    usedThisMonth: usedCount ?? 0,
    lowStock: 0,
    expired: 0,
    expiringSoon: 0,
    expiring30: [],
    expiring60: [],
    expiring90: [],
    byCompany: {},
    byPlatformSize: {},
    byLength: {},
    byLocation: {},
  };

  (data || [])?.forEach(item => {
    if (item?.item_status === 'in_stock') {
      summary.totalInStock += (item?.quantity_in_stock || 0);
      if ((item?.quantity_in_stock || 0) <= (item?.minimum_stock_level || 2)) summary.lowStock++;
    }

    const loc = item?.office_name || 'Unknown';
    summary.byLocation[loc] = (summary?.byLocation?.[loc] || 0) + 1;

    const co = item?.company_name || 'Unknown';
    summary.byCompany[co] = (summary?.byCompany?.[co] || 0) + 1;

    const ps = item?.platform_size_name || 'Unknown';
    summary.byPlatformSize[ps] = (summary?.byPlatformSize?.[ps] || 0) + 1;

    const ln = item?.length_label || 'Unknown';
    summary.byLength[ln] = (summary?.byLength?.[ln] || 0) + 1;

    if (item?.expiration_date) {
      const exp = new Date(item?.expiration_date);
      if (exp < today) {
        summary.expired++;
      } else if (exp <= in30) {
        summary?.expiring30?.push(item);
        summary.expiringSoon++;
      } else if (exp <= in60) {
        summary?.expiring60?.push(item);
        summary.expiringSoon++;
      } else if (exp <= in90) {
        summary?.expiring90?.push(item);
      }
    }
  });

  return summary;
};

export const checkDuplicateImplantId = async (identificationNumber, excludeId = null) => {
  if (!identificationNumber?.trim()) return [];
  let q = supabase?.from('implant_inventory')?.select('id, identification_number, office_name, company_name')?.eq('identification_number', identificationNumber?.trim());
  if (excludeId) q = q?.neq('id', excludeId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createInventoryRecord = async (payload) => {
  const { data, error } = await supabase?.from('implant_inventory')?.insert(payload)?.select()?.single();
  if (error) throw error;
  return data;
};

export const updateInventoryRecord = async (id, payload) => {
  const { data, error } = await supabase?.from('implant_inventory')?.update({ ...payload, updated_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  return data;
};

export const deleteInventoryRecord = async (id) => {
  const { error } = await supabase?.from('implant_inventory')?.delete()?.eq('id', id);
  if (error) throw error;
};

export const restockInventoryItem = async (id, quantityToAdd, userId, userName) => {
  const { data: existing } = await supabase?.from('implant_inventory')?.select('quantity_in_stock')?.eq('id', id)?.single();
  const newQty = (existing?.quantity_in_stock || 0) + quantityToAdd;
  const { data, error } = await supabase?.from('implant_inventory')?.update({
    quantity_in_stock: newQty,
    item_status: 'in_stock',
    updated_by: userId,
    updated_at: new Date()?.toISOString(),
  })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  await logImplantAudit({ recordId: id, recordType: 'inventory', action: 'restocked', changedBy: userId, changedByName: userName, newValues: { quantity_added: quantityToAdd, new_total: newQty } });
  return data;
};

// ── Usage Logs ─────────────────────────────────────────────────────────────
export const fetchUsageLogs = async (filters = {}) => {
  let q = supabase?.from('implant_usage_logs')?.select('*')?.order('procedure_date', { ascending: false })?.order('created_at', { ascending: false });
  if (filters?.officeId) q = q?.eq('office_id', filters?.officeId);
  if (filters?.providerId) q = q?.eq('provider_id', filters?.providerId);
  if (filters?.companyId) q = q?.eq('company_id', filters?.companyId);
  if (filters?.status) q = q?.eq('item_status', filters?.status);
  if (filters?.dateFrom) q = q?.gte('procedure_date', filters?.dateFrom);
  if (filters?.dateTo) q = q?.lte('procedure_date', filters?.dateTo);
  if (filters?.search) {
    q = q?.or(`patient_name.ilike.%${filters?.search}%,provider_name.ilike.%${filters?.search}%,identification_number.ilike.%${filters?.search}%,lot_number.ilike.%${filters?.search}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createUsageLog = async (payload) => {
  const normalized = { ...payload };
  for (const field of ['implant_inventory_id', 'provider_id', 'staff_assistant_id', 'company_id', 'system_id', 'platform_size_id', 'length_id', 'diameter_id']) {
    if (normalized[field] === '') normalized[field] = null;
  }
  const { data, error } = await supabase?.from('implant_usage_logs')?.insert(normalized)?.select()?.single();
  if (error) throw error;
  return data;
};

export const updateUsageLog = async (id, payload) => {
  const { data, error } = await supabase?.from('implant_usage_logs')?.update({ ...payload, updated_at: new Date()?.toISOString() })?.eq('id', id)?.select()?.single();
  if (error) throw error;
  return data;
};

export const deleteUsageLog = async (id) => {
  const { error } = await supabase?.from('implant_usage_logs')?.delete()?.eq('id', id);
  if (error) throw error;
};

// ── Lookup implant by scanned ID ───────────────────────────────────────────
export const lookupImplantByIdNumber = async (identificationNumber) => {
  if (!identificationNumber?.trim()) return null;
  const { data, error } = await supabase?.from('implant_inventory')?.select('*')?.eq('identification_number', identificationNumber?.trim())?.eq('item_status', 'in_stock')?.limit(1);
  if (error) throw error;
  return data?.[0] || null;
};

// ── Scan helpers ───────────────────────────────────────────────────────────
export const lookupImplantByLotOrId = async (identificationNumber, lotNumber) => {
  if (!identificationNumber?.trim() && !lotNumber?.trim()) return null;
  let q = supabase?.from('implant_inventory')?.select('*')?.eq('item_status', 'in_stock');
  if (identificationNumber?.trim()) {
    q = q?.eq('identification_number', identificationNumber?.trim());
  } else if (lotNumber?.trim()) {
    q = q?.eq('lot_number', lotNumber?.trim());
  }
  const { data, error } = await q?.limit(1);
  if (error) throw error;
  return data?.[0] || null;
};

export const receiveImplantByScan = async ({
  identificationNumber,
  lotNumber,
  skuReference,
  companyName,
  systemName,
  platformSizeName,
  officeId,
  officeName,
  expirationDate,
  quantityToAdd,
  userId,
  userName,
  notes,
  scanMethod,
}) => {
  // Try to find existing record by identification_number or lot_number
  const existing = await lookupImplantByLotOrId(identificationNumber, lotNumber);
  if (existing) {
    const newQty = (existing?.quantity_in_stock || 0) + quantityToAdd;
    const { data, error } = await supabase?.from('implant_inventory')?.update({
      quantity_in_stock: newQty,
      item_status: 'in_stock',
      lot_number: lotNumber || existing?.lot_number,
      expiration_date: expirationDate || existing?.expiration_date,
      updated_by: userId,
      updated_at: new Date()?.toISOString(),
    })?.eq('id', existing?.id)?.select()?.single();
    if (error) throw error;
    await logImplantAudit({
      recordId: existing?.id,
      recordType: 'inventory',
      action: 'restocked',
      changedBy: userId,
      changedByName: userName,
      newValues: { quantity_added: quantityToAdd, new_total: newQty, scan_method: scanMethod, notes },
    });
    return data;
  }
  // Create new record
  const payload = {
    identification_number: identificationNumber || null,
    lot_number: lotNumber || null,
    sku_reference: skuReference || null,
    company_name: companyName || null,
    system_name: systemName || null,
    platform_size_name: platformSizeName || null,
    office_id: officeId || null,
    office_name: officeName || null,
    expiration_date: expirationDate || null,
    quantity_in_stock: quantityToAdd,
    item_status: 'in_stock',
    notes: notes || null,
    created_by: userId,
    updated_by: userId,
  };
  const { data, error } = await supabase?.from('implant_inventory')?.insert(payload)?.select()?.single();
  if (error) throw error;
  await logImplantAudit({
    recordId: data?.id,
    recordType: 'inventory',
    action: 'created',
    changedBy: userId,
    changedByName: userName,
    newValues: { ...payload, scan_method: scanMethod },
  });
  return data;
};

export const consumeImplantByScan = async ({
  officeId,
  officeName,
  providerId,
  providerName,
  staffId,
  staffName,
  patientName,
  patientChartNumber,
  procedureDate,
  companyName,
  systemName,
  platformSizeName,
  identificationNumber,
  lotNumber,
  skuReference,
  expirationDate,
  quantityUsed,
  scanMethod,
  notes,
  userId,
  userName,
}) => {
  // Lookup existing stock record
  const existing = await lookupImplantByLotOrId(identificationNumber, lotNumber);
  if (!existing) throw new Error('No matching in-stock implant found for this lot/ID. Please verify the item exists in inventory.');

  const newQty = (existing?.quantity_in_stock || 0) - quantityUsed;
  if (newQty < 0) throw new Error(`Insufficient stock. Available: ${existing?.quantity_in_stock}, requested: ${quantityUsed}`);

  // Decrement stock
  const newStatus = newQty === 0 ? 'used' : 'in_stock';
  const { error: updateError } = await supabase?.from('implant_inventory')?.update({
    quantity_in_stock: newQty,
    item_status: newStatus,
    updated_by: userId,
    updated_at: new Date()?.toISOString(),
  })?.eq('id', existing?.id);
  if (updateError) throw updateError;

  // Write usage log
  const logPayload = {
    office_id: officeId || existing?.office_id,
    office_name: officeName || existing?.office_name,
    implant_inventory_id: existing?.id,
    provider_id: providerId || null,
    provider_name: providerName || null,
    staff_id: staffId || null,
    staff_name: staffName || null,
    patient_name: patientName || null,
    patient_chart_number: patientChartNumber || null,
    procedure_date: procedureDate || new Date()?.toISOString()?.split('T')?.[0],
    company_name: companyName || existing?.company_name,
    system_name: systemName || existing?.system_name,
    platform_size_name: platformSizeName || existing?.platform_size_name,
    identification_number: identificationNumber || existing?.identification_number,
    lot_number: lotNumber || existing?.lot_number,
    sku_reference: skuReference || existing?.sku_reference,
    expiration_date: expirationDate || existing?.expiration_date,
    quantity_used: quantityUsed,
    scan_method: scanMethod || 'manual',
    notes: notes || null,
    created_by: userId,
  };
  const { data: logData, error: logError } = await supabase?.from('implant_usage_logs')?.insert(logPayload)?.select()?.single();
  if (logError) throw logError;

  await logImplantAudit({
    recordId: existing?.id,
    recordType: 'inventory',
    action: 'used',
    changedBy: userId,
    changedByName: userName,
    newValues: { quantity_used: quantityUsed, new_total: newQty, patient: patientName, lot: lotNumber, scan_method: scanMethod },
  });

  return logData;
};

// ── Audit Logs ─────────────────────────────────────────────────────────────
export const logImplantAudit = async ({ recordId, recordType, action, changedBy, changedByName, oldValues, newValues }) => {
  const { error } = await supabase?.from('implant_audit_logs')?.insert({
    record_id: recordId,
    record_type: recordType,
    action,
    changed_by: changedBy,
    changed_by_name: changedByName || '',
    old_values: oldValues || null,
    new_values: newValues || null,
  });
  if (error) console.error('Audit log error:', error);
};

export const fetchAuditLogs = async (recordId) => {
  const { data, error } = await supabase?.from('implant_audit_logs')?.select('*')?.eq('record_id', recordId)?.order('changed_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ── Attachments ────────────────────────────────────────────────────────────
export const uploadImplantAttachment = async (file, userId) => {
  const ext = file?.name?.split('.')?.pop();
  const path = `${userId}/${Date.now()}-${Math.random()?.toString(36)?.slice(2)}.${ext}`;
  const { error } = await supabase?.storage?.from(BUCKET)?.upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
};

export const getImplantAttachmentUrl = async (path) => {
  if (!path) return null;
  const { data, error } = await supabase?.storage?.from(BUCKET)?.createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
};
