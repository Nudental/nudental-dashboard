import { supabase } from '../lib/supabase';

const OFFICES = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

const CATEGORIES = [
  'General Office',
  'Printing & Forms',
  'Patient Check-In/Out',
  'Insurance/Billing',
  'Technology/Equipment',
  'Reception/Waiting',
  'Cleaning/Maintenance',
  'Mail/Shipping',
  'Security/Financial',
  'Emergency/Backup',
];

export const frontDeskInventoryService = {
  getOffices: () => OFFICES,
  getCategories: () => CATEGORIES,

  // ── FETCH ────────────────────────────────────────────────────────────────
  async fetchInventory({ officeLocation, category, status, search, month } = {}) {
    let query = supabase
      ?.from('front_desk_inventory')
      ?.select('*')
      ?.order('category')
      ?.order('item_name');

    if (officeLocation && officeLocation !== 'All Offices') {
      query = query?.eq('office_location', officeLocation);
    }
    if (category && category !== 'All') {
      query = query?.eq('category', category);
    }
    if (status && status !== 'All') {
      query = query?.eq('status', status);
    }
    if (search) {
      query = query?.ilike('item_name', `%${search}%`);
    }
    if (month) {
      const start = `${month}-01`;
      const end = new Date(month + '-01');
      end?.setMonth(end?.getMonth() + 1);
      const endStr = end?.toISOString()?.slice(0, 10);
      query = query?.gte('last_supplied_date', start)?.lt('last_supplied_date', endStr);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // ── UPDATE QTY ───────────────────────────────────────────────────────────
  async updateQty(id, currentQty) {
    const { data, error } = await supabase
      ?.from('front_desk_inventory')
      ?.update({ current_qty: currentQty })
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    return data;
  },

  // ── UPDATE ROW ───────────────────────────────────────────────────────────
  async updateRow(id, updates) {
    const { data, error } = await supabase
      ?.from('front_desk_inventory')
      ?.update({ ...updates, updated_at: new Date()?.toISOString() })
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    return data;
  },

  // ── INSERT ROW ───────────────────────────────────────────────────────────
  async insertRow(row) {
    const { data, error } = await supabase
      ?.from('front_desk_inventory')
      ?.insert(row)
      ?.select()
      ?.single();
    if (error) throw error;
    return data;
  },

  // ── DEACTIVATE (soft delete via status=Discontinued) ─────────────────────
  async deactivateRow(id) {
    const { data, error } = await supabase
      ?.from('front_desk_inventory')
      ?.update({ status: 'Discontinued', updated_at: new Date()?.toISOString() })
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    return data;
  },

  // ── URGENT REQUEST ───────────────────────────────────────────────────────
  async submitUrgentRequest({ itemId, itemName, officeLocation, currentQty, submittedBy, notes, isBulk, bulkItemNames, bulkItemCount }) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const payload = {
      office_id: officeLocation,
      item_name: itemName,
      custom_item_name: itemName,
      priority: 'critical',
      current_qty_on_hand: currentQty,
      requested_qty: 1,
      unit_type: 'unit',
      reason: notes || `Front Desk urgent request: ${itemName} is out of stock at ${officeLocation}`,
      patient_care_impact: false,
      needed_by_date: new Date(Date.now() + 24 * 60 * 60 * 1000)?.toISOString()?.slice(0, 10),
      submitted_by: user?.id,
      status: 'submitted',
    };
    const { data, error } = await supabase
      ?.from('urgent_supply_requests')
      ?.insert(payload)
      ?.select()
      ?.single();
    if (error) throw error;

    // ── Write audit log row to supply_audit_logs ──────────────────────────
    try {
      const now = new Date()?.toISOString();
      await supabase?.from('supply_audit_logs')?.insert({
        record_id: data?.id,
        record_type: 'front_desk_urgent_request',
        action: isBulk
          ? 'front_desk_urgent_all_critical_submitted' :'front_desk_urgent_single_submitted',
        changed_by: user?.id,
        changed_at: now,
        old_values: null,
        new_values: {
          office: officeLocation,
          submitted_by_id: user?.id,
          submitted_by_name: submittedBy || null,
          item_name: itemName,
          current_qty: currentQty ?? null,
          notes: notes || null,
          is_bulk: isBulk || false,
          bulk_item_count: bulkItemCount ?? null,
          bulk_item_names: bulkItemNames ?? null,
          recipient_roles: ['regional_clinical_manager', 'super_admin'],
          sms_attempted: true,
          email_attempted: true,
          priority: 'critical',
          urgent_request_id: data?.id,
        },
      });
    } catch (auditErr) {
      // Non-blocking: log clearly but do not fail the urgent request submission
      console.warn('[frontDeskInventoryService] supply_audit_logs insert failed (non-blocking):', auditErr?.message);
    }

    return data;
  },

  // ── FETCH FRONT DESK URGENT HISTORY ──────────────────────────────────────
  async fetchFrontDeskUrgentHistory({ officeLocation, limit = 50 } = {}) {
    // Query supply_audit_logs for front_desk_urgent_* actions, joined with user_profiles
    let query = supabase
      ?.from('supply_audit_logs')
      ?.select(`
        id,
        record_id,
        action,
        changed_by,
        changed_at,
        new_values,
        submitter:user_profiles!supply_audit_logs_changed_by_fkey(full_name, email)
      `)
      ?.in('action', ['front_desk_urgent_all_critical_submitted', 'front_desk_urgent_single_submitted'])
      ?.eq('record_type', 'front_desk_urgent_request')
      ?.order('changed_at', { ascending: false })
      ?.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    let rows = data || [];

    // Filter by office if provided
    if (officeLocation && officeLocation !== 'All Offices') {
      rows = rows?.filter(r => r?.new_values?.office === officeLocation);
    }

    return rows;
  },

  // ── SEND SMS VIA EDGE FUNCTION ────────────────────────────────────────────
  async sendUrgentSms({ officeLocation, itemName, isBulk, bulkItems }) {
    try {
      const body = isBulk
        ? `🚨 Front Desk URGENT — ${officeLocation} has ${bulkItems?.length} critical items out of stock: ${bulkItems?.slice(0, 5)?.join(', ')}${bulkItems?.length > 5 ? ` and ${bulkItems?.length - 5} more` : ''}. Immediate action required.`
        : `🚨 Front Desk URGENT — ${officeLocation} is out of ${itemName}. Immediate action required.`;

      const { data: { session } } = await supabase?.auth?.getSession();
      const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;

      await fetch(`${supabaseUrl}/functions/v1/send-supply-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          type: 'urgent',
          record_id: 'front-desk',
          office_name: officeLocation,
          submitted_by: 'Front Desk',
          item_count: isBulk ? bulkItems?.length : 1,
          item_name: isBulk ? `${bulkItems?.length} critical items` : itemName,
          priority: 'critical',
          patient_care_impact: false,
          needed_by_date: new Date(Date.now() + 24 * 60 * 60 * 1000)?.toISOString()?.slice(0, 10),
        }),
      });
    } catch (err) {
      console.warn('SMS send failed (non-blocking):', err?.message);
    }
  },

  // ── SEND EMAIL VIA EDGE FUNCTION ──────────────────────────────────────────
  async sendUrgentEmail({ officeLocation, itemName, currentQty, submittedBy, isBulk, bulkItems }) {
    try {
      const { data: recipients } = await supabase
        ?.from('user_profiles')
        ?.select('id, full_name, email, role')
        ?.in('role', ['regional_clinical_manager', 'super_admin'])
        ?.not('email', 'is', null);

      if (!recipients?.length) return;

      const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase?.auth?.getSession();
      const appUrl = 'https://nudentalr1699.builtwithrocket.new';

      const subject = isBulk
        ? `🚨 Front Desk Urgent Request — ${officeLocation} — ${bulkItems?.length} Critical Items`
        : `🚨 Front Desk Urgent Request — ${officeLocation} — ${itemName}`;

      await Promise.allSettled(
        recipients?.map(r =>
          fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              email_type: 'urgent_supply_request',
              recipient_email: r?.email,
              recipient_name: r?.full_name || 'Manager',
              data: {
                office_name: officeLocation,
                item_name: isBulk ? `${bulkItems?.length} critical items (${bulkItems?.slice(0, 3)?.join(', ')}...)` : itemName,
                priority: 'CRITICAL',
                requested_qty: 1,
                unit_type: 'unit',
                current_qty_on_hand: currentQty ?? 0,
                needed_by_date: 'ASAP',
                reason: isBulk
                  ? `Front Desk bulk urgent: ${bulkItems?.join(', ')}`
                  : `Front Desk item out of stock at ${officeLocation}`,
                patient_care_impact: null,
                app_url: appUrl,
              },
            }),
          })
        )
      );
    } catch (err) {
      console.warn('Email send failed (non-blocking):', err?.message);
    }
  },

  // ── SUMMARY STATS ─────────────────────────────────────────────────────────
  async fetchSummary(officeLocation, month) {
    let query = supabase
      ?.from('front_desk_inventory')
      ?.select('status, category, order_status, last_supplied_date');

    if (officeLocation && officeLocation !== 'All Offices') {
      query = query?.eq('office_location', officeLocation);
    }

    const { data, error } = await query;
    if (error) throw error;

    let rows = data || [];
    const now = new Date();
    const monthStr = month || `${now?.getFullYear()}-${String(now?.getMonth() + 1)?.padStart(2, '0')}`;

    return {
      totalInStock: rows?.filter(r => r?.status === 'In Stock')?.length,
      lowItems: rows?.filter(r => r?.status === 'Low')?.length,
      criticalOutOfStock: rows?.filter(r => r?.status === 'Critically Low' || r?.status === 'Out of Stock')?.length,
      totalCategories: CATEGORIES?.length,
      orderedThisMonth: rows?.filter(r => {
        if (!r?.last_supplied_date) return false;
        return r?.last_supplied_date?.startsWith(monthStr);
      })?.length,
    };
  },
};

export default frontDeskInventoryService;
