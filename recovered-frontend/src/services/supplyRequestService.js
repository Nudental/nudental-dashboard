import { supabase } from '../lib/supabase';
import { dashboardEnvironment } from '../config/dashboardEnvironment';
import { get, set, createStore } from 'idb-keyval';

const SUPPLY_CACHE_STORE = createStore('nu-dental-supply-cache', 'supply_cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const getCached = async (key) => {
  try {
    const entry = await get(key, SUPPLY_CACHE_STORE);
    if (!entry) return null;
    if (Date.now() - entry?.ts > CACHE_TTL_MS) return null;
    return entry?.data;
  } catch (_) { return null; }
};

const setCache = async (key, data) => {
  try { await set(key, { data, ts: Date.now() }, SUPPLY_CACHE_STORE); } catch (_) {}
};

const OFFICES = dashboardEnvironment.isQa ? ['QA / Office A', 'QA / Office B'] : [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

export const supplyRequestService = {
  // ── OFFICES ──────────────────────────────────────────────────────────────
  getOffices: () => OFFICES,

  // ── DEPARTMENTS ──────────────────────────────────────────────────────────
  async fetchDepartments() {
    if (!navigator.onLine) {
      const cached = await getCached('supply_departments');
      if (cached) return cached;
    }
    const { data, error } = await supabase?.from('supply_departments')?.select('*')?.eq('is_active', true)?.order('sort_order');
    if (error) throw error;
    const result = data || [];
    await setCache('supply_departments', result);
    return result;
  },

  async upsertDepartment(dept) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const payload = { ...dept, created_by: user?.id };
    if (dept?.id) {
      const { data, error } = await supabase?.from('supply_departments')?.update(payload)?.eq('id', dept?.id)?.select()?.single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase?.from('supply_departments')?.insert(payload)?.select()?.single();
    if (error) throw error;
    return data;
  },

  // ── SUBSECTIONS ──────────────────────────────────────────────────────────
  async fetchSubsections(departmentId = null) {
    const cacheKey = departmentId ? `supply_subsections_${departmentId}` : 'supply_subsections';
    if (!navigator.onLine) {
      const cached = await getCached(cacheKey);
      if (cached) return cached;
    }
    let query = supabase?.from('supply_subsections')?.select('*, supply_departments(name)')?.eq('is_active', true)?.order('name');
    if (departmentId) query = query?.eq('department_id', departmentId);
    const { data, error } = await query;
    if (error) throw error;
    const result = data || [];
    await setCache(cacheKey, result);
    return result;
  },

  async upsertSubsection(sub) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const payload = { ...sub, created_by: user?.id };
    if (sub?.id) {
      const { data, error } = await supabase?.from('supply_subsections')?.update(payload)?.eq('id', sub?.id)?.select()?.single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase?.from('supply_subsections')?.insert(payload)?.select()?.single();
    if (error) throw error;
    return data;
  },

  // ── SUPPLY ITEMS ─────────────────────────────────────────────────────────
  async fetchItems(subsectionId = null, departmentId = null, departmentCategory = null) {
    const cacheKey = subsectionId ? `supply_items_sub_${subsectionId}` : departmentId ? `supply_items_dept_${departmentId}` : departmentCategory ? `supply_items_cat_${departmentCategory}` : 'supply_items';
    if (!navigator.onLine) {
      const cached = await getCached(cacheKey);
      if (cached) return cached;
    }
    let query = supabase?.from('supply_items')?.select('*, supply_subsections(name), supply_departments(name)')?.eq('is_active', true)?.order('name');
    if (subsectionId) query = query?.eq('subsection_id', subsectionId);
    if (departmentId) query = query?.eq('department_id', departmentId);
    if (departmentCategory) query = query?.eq('department_category', departmentCategory);
    const { data, error } = await query;
    if (error) throw error;
    const result = data || [];
    await setCache(cacheKey, result);
    return result;
  },

  async upsertItem(item) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const payload = { ...item, created_by: user?.id };
    if (item?.id) {
      const { data, error } = await supabase?.from('supply_items')?.update(payload)?.eq('id', item?.id)?.select()?.single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase?.from('supply_items')?.insert(payload)?.select()?.single();
    if (error) throw error;
    return data;
  },

  // ── UPDATE ITEM CATEGORY (admin/super_admin only) ─────────────────────────
  async updateItemCategory(itemId, oldCategory, newCategory) {
    const { data: { user } } = await supabase?.auth?.getUser();
    if (!user?.id) throw new Error('Not authenticated');

    // Update only department_category — no other fields touched
    const { data, error } = await supabase
      ?.from('supply_items')
      ?.update({ department_category: newCategory })
      ?.eq('id', itemId)
      ?.select('id, name, department_category')
      ?.single();
    if (error) throw error;

    // Write audit log — non-blocking: log gap but do not block the update
    const { error: auditErr } = await supabase
      ?.from('supply_audit_logs')
      ?.insert({
        record_type: 'supply_item',
        record_id: itemId,
        action: 'category_updated',
        changed_by: user?.id,
        changed_at: new Date()?.toISOString(),
        old_values: { department_category: oldCategory },
        new_values: { department_category: newCategory },
      });

    if (auditErr) {
      // Audit gap — update succeeded but log failed; report clearly
      console.warn('[supplyRequestService] updateItemCategory: supply_audit_logs insert failed (audit gap):', auditErr?.message, auditErr);
    }

    return data;
  },

  // ── VENDORS ──────────────────────────────────────────────────────────────
  async fetchVendors() {
    const { data, error } = await supabase?.from('supply_vendors')?.select('*')?.eq('is_active', true)?.order('name');
    if (error) throw error;
    return data || [];
  },

  async upsertVendor(vendor) {
    if (vendor?.id) {
      const { data, error } = await supabase?.from('supply_vendors')?.update(vendor)?.eq('id', vendor?.id)?.select()?.single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase?.from('supply_vendors')?.insert(vendor)?.select()?.single();
    if (error) throw error;
    return data;
  },

  // ── INVENTORY ────────────────────────────────────────────────────────────
  async fetchInventory(filters = {}) {
    const hasFilters = Object.values(filters)?.some(v => v !== '' && v !== false && v !== null && v !== undefined);
    const cacheKey = hasFilters ? null : 'supply_inventory_all';
    if (!navigator.onLine && cacheKey) {
      const cached = await getCached(cacheKey);
      if (cached) return cached;
    }
    let query = supabase?.from('office_supply_inventory')?.select(`
        *,
        supply_departments(name),
        supply_subsections(name),
        supply_items(name, sku, brand, department_category)
      `)?.order('item_name');

    if (filters?.officeId) query = query?.eq('office_id', filters?.officeId);
    if (filters?.itemId) query = query?.eq('item_id', filters?.itemId);
    if (filters?.departmentId) query = query?.eq('department_id', filters?.departmentId);
    if (filters?.subsectionId) query = query?.eq('subsection_id', filters?.subsectionId);
    if (filters?.status) query = query?.eq('inv_status', filters?.status);
    if (filters?.lowStockOnly) query = query?.in('inv_status', ['low', 'critically_low', 'out_of_stock']);
    if (filters?.expiringSoon) {
      const soon = new Date();
      soon?.setDate(soon?.getDate() + 90);
      query = query?.lte('expiration_date', soon?.toISOString()?.split('T')?.[0])?.not('expiration_date', 'is', null);
    }
    if (filters?.search) {
      query = query?.or(`item_name.ilike.%${filters?.search}%,brand.ilike.%${filters?.search}%,sku.ilike.%${filters?.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const result = data || [];
    if (cacheKey) await setCache(cacheKey, result);
    return result;
  },

  async upsertInventoryItem(item) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const payload = { ...item, last_updated_by: user?.id, updated_at: new Date()?.toISOString() };
    if (item?.id) {
      const { data, error } = await supabase?.from('office_supply_inventory')?.update(payload)?.eq('id', item?.id)?.select()?.single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase?.from('office_supply_inventory')?.insert(payload)?.select()?.single();
    if (error) throw error;
    return data;
  },

  async adjustInventory(inventoryId, newQty, reason, notes) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const { data: current, error: fetchErr } = await supabase?.from('office_supply_inventory')?.select('*')?.eq('id', inventoryId)?.single();
    if (fetchErr) throw fetchErr;
    if (newQty === current?.quantity_on_hand) return current;

    const { data, error } = await supabase?.from('office_supply_inventory')?.update({ quantity_on_hand: newQty, last_updated_by: user?.id, updated_at: new Date()?.toISOString() })?.eq('id', inventoryId)?.select()?.single();
    if (error) throw error;

    await supabase?.from('supply_inventory_history')?.insert({
      inventory_id: inventoryId,
      office_id: current?.office_id,
      change_type: 'adjustment',
      old_qty: current?.quantity_on_hand,
      new_qty: newQty,
      change_qty: newQty - current?.quantity_on_hand,
      changed_by: user?.id,
      change_reason: reason || notes || 'Manual adjustment',
    });

    return data;
  },

  async fetchInventoryHistory(inventoryId) {
    const { data, error } = await supabase?.from('supply_inventory_history')?.select('*, user_profiles(full_name)')?.eq('inventory_id', inventoryId)?.order('created_at', { ascending: false })?.limit(50);
    if (error) throw error;
    return data || [];
  },

  async fetchInventorySummary(officeId = null) {
    let query = supabase?.from('office_supply_inventory')?.select('inv_status, office_id');
    if (officeId) query = query?.eq('office_id', officeId);
    const { data, error } = await query;
    if (error) throw error;
    const summary = { total: 0, in_stock: 0, low: 0, critically_low: 0, out_of_stock: 0, discontinued: 0 };
    (data || [])?.forEach(r => {
      summary.total++;
      summary[r.inv_status] = (summary?.[r?.inv_status] || 0) + 1;
    });
    return summary;
  },

  // ── MONTHLY REQUESTS ─────────────────────────────────────────────────────
  async fetchRequestBatches(filters = {}) {
    let query = supabase?.from('supply_request_batches')?.select(`
        *,
        requested_by_profile:user_profiles!supply_request_batches_requested_by_fkey(full_name),
        reviewer_profile:user_profiles!supply_request_batches_reviewer_id_fkey(full_name),
        request_items:supply_request_items(custom_item_name, supply_items(name))
      `)?.order('created_at', { ascending: false });

    if (filters?.officeId) query = query?.eq('office_id', filters?.officeId);
    if (filters?.requestType) query = query?.eq('request_type', filters?.requestType);
    if (filters?.status) query = query?.eq('batch_status', filters?.status);
    if (filters?.month) query = query?.eq('request_month', filters?.month?.length === 7 ? `${filters?.month}-01` : filters?.month);
    if (filters?.departmentCategory) query = query?.eq('department_category', filters?.departmentCategory);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async fetchRequestItems(batchId) {
    const { data, error } = await supabase?.from('supply_request_items')?.select(`
        *,
        supply_departments(name),
        supply_subsections(name),
        supply_items(name)
      `)?.eq('batch_id', batchId)?.order('created_at');
    if (error) throw error;
    return data || [];
  },

  async saveDraftBatch(batch, items) {
    if (dashboardEnvironment.isQa) {
      const { data, error } = await supabase.rpc('save_supply_request_draft', {
        p_batch: batch,
        p_items: (items || []).map(item => ({
          ...item,
          department_id: item?.department_id === '' ? null : item?.department_id,
          subsection_id: item?.subsection_id === '' ? null : item?.subsection_id,
          item_id: item?.item_id === '' ? null : item?.item_id,
        })),
      });
      if (error) throw error;
      return data;
    }
    const { data: { user } } = await supabase?.auth?.getUser();
    let batchData;

    if (batch?.id) {
      const { data, error } = await supabase?.from('supply_request_batches')?.update({ ...batch, updated_at: new Date()?.toISOString() })?.eq('id', batch?.id)?.select()?.single();
      if (error) throw error;
      batchData = data;
      // Delete existing items and re-insert
      await supabase?.from('supply_request_items')?.delete()?.eq('batch_id', batch?.id);
    } else {
      const { data, error } = await supabase?.from('supply_request_batches')?.insert({ ...batch, requested_by: user?.id, batch_status: 'draft' })?.select()?.single();
      if (error) throw error;
      batchData = data;
    }

    if (items?.length > 0) {
      const itemsToInsert = items?.map(item => ({
        ...item,
        department_id: item?.department_id === '' ? null : item?.department_id,
        subsection_id: item?.subsection_id === '' ? null : item?.subsection_id,
        item_id: item?.item_id === '' ? null : item?.item_id,
        batch_id: batchData?.id,
        office_id: batch?.office_id,
        department_category: batch?.department_category || null,
      }));
      const { error: itemsErr } = await supabase?.from('supply_request_items')?.insert(itemsToInsert);
      if (itemsErr) throw itemsErr;
    }

    return batchData;
  },

  async submitBatch(batchId) {
    if (dashboardEnvironment.isQa) {
      const { data, error } = await supabase.rpc('submit_supply_request_qa', { p_batch_id: batchId });
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase?.from('supply_request_batches')?.update({ batch_status: 'submitted', submitted_at: new Date()?.toISOString(), updated_at: new Date()?.toISOString() })?.eq('id', batchId)?.select()?.single();
    if (error) throw error;

    // ── Email notification routing ──────────────────────────────────────────
    // Front Desk: FrontDeskInventoryTab fires order-request-notifications directly.
    //   Do NOT fire here — would cause duplicate email.
    // Back Staff / Clinical Supply: fire order-request-notifications here with
    //   request_type='Back Staff' so the edge function uses the Clinical Supply
    //   branded template (subject: "Clinical Supply Request Submitted — [Office]",
    //   To: Maia@thenudental.com, CC: admasu@thenudental.com).
    // This replaces the old notifyRCMNewMonthlyRequest call which used the generic
    //   "Monthly Supply Request Submitted" template with no branding or item table.
    const isFrontDeskBatch = data?.department_category === 'Front Desk';
    const isBackStaffBatch = data?.department_category === 'Back Staff' || data?.department_category === 'Clinical';

    if (isBackStaffBatch) {
      // Fire Clinical Supply branded email via order-request-notifications (fire-and-forget)
      try {
        const { data: { user } } = await supabase?.auth?.getUser();
        const { data: profile } = await supabase?.from('user_profiles')?.select('full_name, email')?.eq('id', user?.id)?.single();
        const { data: items } = await supabase?.from('supply_request_items')
          ?.select('id, item_id, custom_item_name, requested_qty, unit_type, priority, reason_notes, supply_items(name)')
          ?.eq('batch_id', batchId);

        const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

        const notifPayload = {
          id:                 batchId,
          office_name:        data?.office_id || 'Nu Dental',
          request_type:       'Back Staff',
          priority:           data?.priority || 'normal',
          is_monthly_request: true,
          submitted_by_name:  profile?.full_name || 'Team Member',
          requester_email:    profile?.email || '',
          request_month:      data?.request_month || '',
          created_at:         data?.submitted_at || new Date()?.toISOString(),
          items: (items || [])?.map(it => ({
            item_name:     it?.custom_item_name || it?.supply_items?.name || '—',
            requested_qty: it?.requested_qty ?? 1,
            unit_type:     it?.unit_type || '',
            priority:      it?.priority || '',
            notes:         it?.reason_notes || '',
          })),
        };

        fetch(`${supabaseUrl}/functions/v1/order-request-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify(notifPayload),
        })?.catch(err => {
          console.warn('[supplyRequestService] Clinical Supply order-request-notifications failed:', err?.message);
        });
      } catch (notifErr) {
        console.warn('[supplyRequestService] Clinical Supply notification error:', notifErr?.message);
      }
    } else if (!isFrontDeskBatch) {
      // Non-Front-Desk, non-Back-Staff batch: fall back to legacy RCM notification
      try {
        const { data: { user } } = await supabase?.auth?.getUser();
        const { data: profile } = await supabase?.from('user_profiles')?.select('full_name')?.eq('id', user?.id)?.single();
        const { data: items } = await supabase?.from('supply_request_items')?.select('id')?.eq('batch_id', batchId);
        const { notifyRCMNewMonthlyRequest } = await import('./rcmEmailService.js');
        notifyRCMNewMonthlyRequest(
          data,
          data?.office_id || 'Nu Dental',
          data?.request_month || '',
          profile?.full_name || 'Team Member',
          items?.length || 0
        );
      } catch (_) {}
    }

    // Send SMS to RCM/super_admin users (fire-and-forget)
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      const { data: profile } = await supabase?.from('user_profiles')?.select('full_name')?.eq('id', user?.id)?.single();
      const { data: items } = await supabase?.from('supply_request_items')?.select('id')?.eq('batch_id', batchId);
      const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
      fetch(`${supabaseUrl}/functions/v1/send-supply-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          type: 'monthly',
          record_id: batchId,
          office_name: data?.office_id || 'Nu Dental',
          submitted_by: profile?.full_name || 'Team Member',
          item_count: items?.length || 0,
          request_month: data?.request_month || '',
        }),
      })?.catch(() => {});
    } catch (_) {}

    return data;
  },

  async updateBatchStatus(batchId, status, reviewerNotes = '') {
    const { data: { user } } = await supabase?.auth?.getUser();

    // Fetch existing batch values before update so we can record old_values in audit log
    const { data: existingBatch, error: fetchErr } = await supabase
      ?.from('supply_request_batches')
      ?.select('batch_status, reviewer_id, reviewer_notes, department_category')
      ?.eq('id', batchId)
      ?.single();
    if (fetchErr) throw fetchErr;

    const now = new Date()?.toISOString();

    const { data, error } = await supabase
      ?.from('supply_request_batches')
      ?.update({
        batch_status: status,
        reviewer_id: user?.id,
        reviewer_notes: reviewerNotes,
        updated_at: now,
      })
      ?.eq('id', batchId)
      ?.select()
      ?.single();
    if (error) throw error;

    // The QA Front Desk trigger records review history in the same transaction.
    if (dashboardEnvironment.isQa && existingBatch?.department_category === 'Front Desk') return data;

    // Map status to audit action label
    const actionMap = {
      approved: 'status_approved',
      rejected: 'status_rejected',
      under_review: 'status_under_review',
      submitted: 'status_submitted',
      fulfilled: 'status_fulfilled',
      partially_fulfilled: 'status_partially_fulfilled',
    };
    const auditAction = actionMap?.[status] || `status_${status}`;

    // Write audit log row — do NOT silently swallow failures
    const { error: auditErr } = await supabase
      ?.from('supply_audit_logs')
      ?.insert({
        record_id: batchId,
        record_type: 'supply_request_batch',
        action: auditAction,
        changed_by: user?.id,
        changed_at: now,
        old_values: {
          batch_status: existingBatch?.batch_status ?? null,
          reviewer_id: existingBatch?.reviewer_id ?? null,
          reviewer_notes: existingBatch?.reviewer_notes ?? null,
        },
        new_values: {
          batch_status: status,
          reviewer_id: user?.id,
          reviewer_notes: reviewerNotes,
        },
      });

    if (auditErr) {
      // Log clearly — do not fake audit success
      console.error('[supplyRequestService] supply_audit_logs insert failed:', auditErr?.message, auditErr);
      throw new Error(`Status updated but audit log failed: ${auditErr?.message}`);
    }

    return data;
  },

  async updateRequestItem(itemId, updates) {
    const { data, error } = await supabase?.from('supply_request_items')?.update(updates)?.eq('id', itemId)?.select()?.single();
    if (error) throw error;
    return data;
  },

  // ── URGENT REQUESTS ──────────────────────────────────────────────────────
  async fetchUrgentRequests(filters = {}) {
    let query = supabase?.from('urgent_supply_requests')?.select(`
        *,
        supply_items(name),
        supply_departments(name),
        supply_subsections(name),
        requested_by_profile:user_profiles!urgent_supply_requests_requested_by_fkey(full_name),
        acknowledged_by_profile:user_profiles!urgent_supply_requests_acknowledged_by_fkey(full_name)
      `)?.order('created_at', { ascending: false });

    if (filters?.officeId) query = query?.eq('office_id', filters?.officeId);
    if (filters?.status) query = query?.eq('urgent_status', filters?.status);
    if (filters?.priority) query = query?.eq('priority', filters?.priority);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createUrgentRequest(req) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const payload = { ...req, requested_by: user?.id, urgent_status: 'submitted' };
    for (const field of ['department_id', 'subsection_id', 'item_id', 'needed_by_date']) {
      if (payload[field] === '') payload[field] = null;
    }
    const { data, error } = await supabase?.from('urgent_supply_requests')?.insert(payload)?.select()?.single();
    if (error) throw error;
    // Isolated QA records both notification simulations in the insert transaction.
    if (dashboardEnvironment.isQa) return data;

    // ── Clinical Supply Urgent email notification ──────────────────────────
    // Replaces old notifyRCMUrgentRequest (which used generic send-email / onboarding@resend.dev).
    // Now fires order-request-notifications with is_urgent_clinical_supply=true so the edge
    // function uses buildClinicalSupplyUrgentEmailHtml:
    //   Subject:  URGENT Clinical Supply Request — [Office] — [Item]
    //   To:       Maia@thenudental.com
    //   CC:       admasu@thenudental.com
    //   From:     Nu Dental Inventory <NUDENTAL_FROM_EMAIL>
    //   Reply-To: requester email
    //   Template: Nu Dental branded urgent layout with all item/requester details
    try {
      const { data: profile } = await supabase?.from('user_profiles')?.select('full_name, email')?.eq('id', user?.id)?.single();
      const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

      const itemName = data?.custom_item_name || req?.custom_item_name || '—';

      const urgentNotifPayload = {
        id:                       data?.id,
        office_name:              data?.office_id || req?.office_id || 'Nu Dental',
        request_type:             'Back Staff',
        priority:                 data?.priority || req?.priority || 'urgent',
        is_monthly_request:       false,
        is_urgent_clinical_supply: true,
        // ── item-level fields for urgent template ──
        item_name:                itemName,
        requested_qty:            data?.requested_qty ?? req?.requested_qty ?? 1,
        current_qty_on_hand:      data?.current_qty_on_hand ?? req?.current_qty_on_hand ?? 0,
        unit_type:                data?.unit_type || req?.unit_type || '',
        needed_by_date:           data?.needed_by_date || req?.needed_by_date || '',
        reason:                   data?.reason || req?.reason || '',
        // ── requester ──
        submitted_by_name:        profile?.full_name || 'Team Member',
        requester_email:          profile?.email || '',
        created_at:               data?.created_at || new Date()?.toISOString(),
        items: [],
      };

      fetch(`${supabaseUrl}/functions/v1/order-request-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(urgentNotifPayload),
      })?.catch(err => {
        console.warn('[supplyRequestService] Clinical Supply urgent order-request-notifications failed:', err?.message);
      });
    } catch (notifErr) {
      console.warn('[supplyRequestService] Clinical Supply urgent notification error:', notifErr?.message);
    }

    // Send SMS to RCM/super_admin users (fire-and-forget)
    try {
      const { data: profile } = await supabase?.from('user_profiles')?.select('full_name')?.eq('id', user?.id)?.single();
      const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
      fetch(`${supabaseUrl}/functions/v1/send-supply-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          type: 'urgent',
          record_id: data?.id,
          office_name: data?.office_id || 'Nu Dental',
          submitted_by: profile?.full_name || 'Team Member',
          item_count: 1,
          item_name: data?.item_name || req?.item_name || 'Supply Item',
          priority: data?.priority || req?.priority || 'urgent',
          patient_care_impact: data?.patient_care_impact ?? req?.patient_care_impact ?? false,
          needed_by_date: data?.needed_by_date || req?.needed_by_date || '',
        }),
      })?.catch(() => {});
    } catch (_) {}

    return data;
  },

  async updateUrgentRequestStatus(id, status, acknowledgedBy = null) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const updates = { urgent_status: status, updated_at: new Date()?.toISOString() };
    if (status === 'acknowledged') {
      updates.acknowledged_by = user?.id;
      updates.acknowledged_at = new Date()?.toISOString();
    }
    const { data, error } = await supabase?.from('urgent_supply_requests')?.update(updates)?.eq('id', id)?.select()?.single();
    if (error) throw error;
    return data;
  },

  async countUnacknowledgedUrgent() {
    const { count, error } = await supabase?.from('urgent_supply_requests')?.select('*', { count: 'exact', head: true })?.eq('urgent_status', 'submitted');
    if (error) return 0;
    return count || 0;
  },

  // ── FULFILLMENT ──────────────────────────────────────────────────────────
  async fetchFulfillmentLogs(filters = {}) {
    let query = supabase?.from('supply_fulfillment_logs')?.select(`
        *,
        supply_departments(name),
        supply_vendors(name),
        supplied_by_profile:user_profiles!supply_fulfillment_logs_supplied_by_fkey(full_name),
        received_by_profile:user_profiles!supply_fulfillment_logs_received_by_fkey(full_name)
      `)?.order('created_at', { ascending: false });

    if (filters?.officeId) query = query?.eq('office_id', filters?.officeId);
    if (filters?.requestType) query = query?.eq('request_type', filters?.requestType);
    if (filters?.status) query = query?.eq('log_fulfillment_status', filters?.status);
    if (filters?.dateFrom) query = query?.gte('date_supplied', filters?.dateFrom);
    if (filters?.dateTo) query = query?.lte('date_supplied', filters?.dateTo);
    if (filters?.departmentId) query = query?.eq('department_id', filters?.departmentId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async fetchFulfillmentRecipients() {
    const { data, error } = await supabase.from('user_profiles').select('id, full_name')
      .eq('is_active', true).eq('is_approved', true).eq('status', 'Active').order('full_name');
    if (error) throw error;
    return data || [];
  },

  async createFulfillmentLog(log) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const payload = { ...log, supplied_by: user?.id };
    for (const field of ['item_id', 'department_id', 'received_by', 'date_supplied', 'date_received']) {
      if (payload[field] === '') payload[field] = null;
    }
    const { data, error } = await supabase?.from('supply_fulfillment_logs')?.insert(payload)?.select()?.single();
    if (error) throw error;

    // Auto-update inventory if item_id and office_id provided
    if (log?.item_id && log?.office_id && log?.qty_supplied > 0) {
      const { data: invItem } = await supabase?.from('office_supply_inventory')?.select('id, quantity_on_hand')?.eq('item_id', log?.item_id)?.eq('office_id', log?.office_id)?.maybeSingle();

      if (invItem) {
        const newQty = (invItem?.quantity_on_hand || 0) + log?.qty_supplied;
        await supabase?.from('office_supply_inventory')?.update({
          quantity_on_hand: newQty,
          last_supplied_date: log?.date_supplied || new Date()?.toISOString()?.split('T')?.[0],
          last_supplied_quantity: log?.qty_supplied,
          last_updated_by: user?.id,
          updated_at: new Date()?.toISOString(),
        })?.eq('id', invItem?.id);

        await supabase?.from('supply_inventory_history')?.insert({
          inventory_id: invItem?.id,
          office_id: log?.office_id,
          change_type: 'supplied',
          old_qty: invItem?.quantity_on_hand,
          new_qty: newQty,
          change_qty: log?.qty_supplied,
          changed_by: user?.id,
          change_reason: `Fulfillment: ${log?.item_name}`,
        });
      }
    }

    // Update request item status if linked
    if (log?.request_item_id) {
      const { data: reqItem } = await supabase?.from('supply_request_items')?.select('requested_qty, fulfilled_qty')?.eq('id', log?.request_item_id)?.single();
      if (reqItem) {
        const totalFulfilled = (reqItem?.fulfilled_qty || 0) + log?.qty_supplied;
        const newStatus = totalFulfilled >= reqItem?.requested_qty ? 'fulfilled' : 'partially_fulfilled';
        await supabase?.from('supply_request_items')?.update({
          fulfilled_qty: totalFulfilled,
          item_status: newStatus,
        })?.eq('id', log?.request_item_id);
      }
    }

    return data;
  },

  // ── OVERVIEW STATS ───────────────────────────────────────────────────────
  async fetchOverviewStats(officeId = null, month = null, departmentCategory = null) {
    const currentMonth = month || new Date()?.toISOString()?.slice(0, 7);
    const monthStart = `${currentMonth}-01`;
    const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0)?.toISOString()?.split('T')?.[0];

    let pendingQuery = supabase?.from('supply_request_batches')?.select('*', { count: 'exact', head: true })?.in('batch_status', ['submitted', 'under_review', 'approved']);
    if (departmentCategory) pendingQuery = pendingQuery?.eq('department_category', departmentCategory);

    const [invSummary, urgentCount, requestedCount, fulfilledCount, pendingCount] = await Promise.all([
      this.fetchInventorySummary(officeId),
      supabase?.from('urgent_supply_requests')?.select('*', { count: 'exact', head: true })?.in('urgent_status', ['submitted', 'acknowledged', 'in_process'])?.then(r => r?.count || 0),
      supabase?.from('supply_request_items')?.select('*', { count: 'exact', head: true })?.gte('created_at', monthStart)?.lte('created_at', monthEnd + 'T23:59:59')?.then(r => r?.count || 0),
      supabase?.from('supply_fulfillment_logs')?.select('*', { count: 'exact', head: true })?.eq('log_fulfillment_status', 'completed')?.gte('date_supplied', monthStart)?.lte('date_supplied', monthEnd)?.then(r => r?.count || 0),
      pendingQuery?.then(r => r?.count || 0),
    ]);

    return {
      totalOnHand: invSummary?.total,
      requestedThisMonth: requestedCount,
      urgentOpen: urgentCount,
      criticallyLow: invSummary?.critically_low + invSummary?.out_of_stock,
      fulfilledThisMonth: fulfilledCount,
      pendingRequests: pendingCount,
    };
  },

  async fetchRecentlySupplied(limit = 10) {
    const { data, error } = await supabase?.from('supply_fulfillment_logs')?.select('*')?.eq('log_fulfillment_status', 'completed')?.order('date_supplied', { ascending: false })?.limit(limit);
    if (error) return [];
    return data || [];
  },

  async fetchRequestsByLocation(departmentCategory = null) {
    let query = supabase?.from('supply_request_batches')?.select('office_id, batch_status');
    if (departmentCategory) query = query?.eq('department_category', departmentCategory);
    const { data, error } = await query;
    if (error) return [];
    const grouped = {};
    (data || [])?.forEach(r => {
      if (!grouped?.[r?.office_id]) grouped[r.office_id] = { office: r?.office_id, total: 0, pending: 0, fulfilled: 0 };
      grouped[r.office_id].total++;
      if (['submitted', 'under_review', 'approved']?.includes(r?.batch_status)) grouped[r.office_id].pending++;
      if (r?.batch_status === 'fulfilled') grouped[r.office_id].fulfilled++;
    });
    return Object.values(grouped);
  },

  async fetchCriticallyLowByOffice() {
    const { data, error } = await supabase?.from('office_supply_inventory')?.select('office_id, inv_status')?.in('inv_status', ['critically_low', 'out_of_stock']);
    if (error) return [];
    const grouped = {};
    (data || [])?.forEach(r => {
      if (!grouped?.[r?.office_id]) grouped[r.office_id] = { office: r?.office_id, critically_low: 0, out_of_stock: 0 };
      grouped[r.office_id][r.inv_status]++;
    });
    return Object.values(grouped);
  },

  async fetchMonthlyFulfillmentRate(months = 6) {
    const results = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d?.setMonth(d?.getMonth() - i);
      const monthStr = d?.toISOString()?.slice(0, 7);
      const monthStart = `${monthStr}-01`;
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)?.toISOString()?.split('T')?.[0];

      const [totalRes, fulfilledRes] = await Promise.all([
        supabase?.from('supply_request_items')?.select('*', { count: 'exact', head: true })?.gte('created_at', monthStart)?.lte('created_at', monthEnd + 'T23:59:59'),
        supabase?.from('supply_request_items')?.select('*', { count: 'exact', head: true })?.eq('item_status', 'fulfilled')?.gte('created_at', monthStart)?.lte('created_at', monthEnd + 'T23:59:59'),
      ]);

      const total = totalRes?.count || 0;
      const fulfilled = fulfilledRes?.count || 0;

      results?.push({
        month: d?.toLocaleString('default', { month: 'short', year: '2-digit' }),
        total: total || 0,
        fulfilled: fulfilled || 0,
        rate: total > 0 ? Math.round(((fulfilled || 0) / total) * 100) : 0,
      });
    }
    return results;
  },

  // ── CACHE REFRESH ────────────────────────────────────────────────────────
  async refreshOfflineCache() {
    if (!navigator.onLine) return;
    try {
      const [depts, subs, items, inv] = await Promise.all([
        supabase?.from('supply_departments')?.select('*')?.eq('is_active', true)?.order('sort_order'),
        supabase?.from('supply_subsections')?.select('*, supply_departments(name)')?.eq('is_active', true)?.order('name'),
        supabase?.from('supply_items')?.select('*, supply_subsections(name), supply_departments(name)')?.eq('is_active', true)?.order('name'),
        supabase?.from('office_supply_inventory')?.select('*, supply_departments(name), supply_subsections(name), supply_items(name, sku, brand)')?.order('item_name'),
      ]);
      if (!depts?.error) await setCache('supply_departments', depts?.data || []);
      if (!subs?.error) await setCache('supply_subsections', subs?.data || []);
      if (!items?.error) await setCache('supply_items', items?.data || []);
      if (!inv?.error) await setCache('supply_inventory_all', inv?.data || []);
    } catch (_) {}
  },

  // ── RECEIVE SUPPLIES ─────────────────────────────────────────────────────
  async receiveSupplies(payload) {
    if (dashboardEnvironment.isQa) {
      const { data, error } = await supabase.rpc('receive_supply_receipt', { p_payload: payload });
      if (error) throw error;
      if (!data?.success) throw new Error('Receipt was not confirmed. Refresh before retrying.');
      return data;
    }
    const { data: { user } } = await supabase?.auth?.getUser();
    const { fulfillment_log_id, office_id, items, received_by, date_received, notes } = payload;
    const today = date_received || new Date()?.toISOString()?.split('T')?.[0];

    for (const item of (items || [])) {
      const receivedQty = item?.received_qty || 0;
      if (receivedQty <= 0) continue;

      // Determine fulfillment status
      const qtySupplied = item?.qty_supplied || 0;
      const newStatus = receivedQty >= qtySupplied ? 'completed' : 'partial';

      // Update fulfillment log row
      const { error: receiptError } = await supabase?.from('supply_fulfillment_logs')?.update({
        qty_received: receivedQty,
        date_received: today,
        received_by: user?.id,
        log_fulfillment_status: newStatus,
        tracking_notes: notes || null,
        updated_at: new Date()?.toISOString(),
      })?.eq('id', item?.id)?.select('id')?.single();
      if (receiptError) throw receiptError;

      // Auto-update office_supply_inventory
      if (item?.item_id && office_id) {
        const { data: invItem } = await supabase
          ?.from('office_supply_inventory')
          ?.select('id, quantity_on_hand')
          ?.eq('item_id', item?.item_id)
          ?.eq('office_id', office_id)
          ?.maybeSingle();

        if (invItem) {
          const newQty = (invItem?.quantity_on_hand || 0) + receivedQty;
          await supabase?.from('office_supply_inventory')?.update({
            quantity_on_hand: newQty,
            last_supplied_date: today,
            last_supplied_quantity: receivedQty,
            last_updated_by: user?.id,
            updated_at: new Date()?.toISOString(),
          })?.eq('id', invItem?.id);

          // Log to supply_inventory_history
          await supabase?.from('supply_inventory_history')?.insert({
            inventory_id: invItem?.id,
            office_id,
            change_type: 'supplied',
            old_qty: invItem?.quantity_on_hand,
            new_qty: newQty,
            change_qty: receivedQty,
            changed_by: user?.id,
            change_reason: `Received: ${item?.item_name}`,
          });
        }
      }

      // Update supply_request_items status if linked
      if (item?.request_item_id) {
        const { data: reqItem } = await supabase
          ?.from('supply_request_items')
          ?.select('requested_qty, fulfilled_qty')
          ?.eq('id', item?.request_item_id)
          ?.single();
        if (reqItem) {
          const totalFulfilled = (reqItem?.fulfilled_qty || 0) + receivedQty;
          const itemStatus = totalFulfilled >= reqItem?.requested_qty ? 'fulfilled' : 'partially_fulfilled';
          await supabase?.from('supply_request_items')?.update({
            fulfilled_qty: totalFulfilled,
            item_status: itemStatus,
          })?.eq('id', item?.request_item_id);
        }
      }
    }

    return { success: true };
  },

  // ── CHECK EXISTING BATCH FOR DEPT CATEGORY ───────────────────────────────
  async checkExistingBatchForDept(officeId, requestMonth, departmentCategory) {
    if (!officeId || !requestMonth || !departmentCategory) return null;
    const monthDate = requestMonth?.length === 7 ? `${requestMonth}-01` : requestMonth;
    const { data, error } = await supabase
      ?.from('supply_request_batches')
      ?.select('id, batch_status, department_category')
      ?.eq('office_id', officeId)
      ?.eq('request_month', monthDate)
      ?.eq('department_category', departmentCategory)
      ?.not('batch_status', 'eq', 'rejected')
      ?.maybeSingle();
    if (error) return null;
    return data || null;
  },
};

export default supplyRequestService;
