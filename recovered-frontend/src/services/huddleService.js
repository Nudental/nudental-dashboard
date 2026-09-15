import { supabase } from '../lib/supabase';

const FRONT_DESK_ITEMS = [
  'Did any patients leave without scheduling their next hygiene appointment? If so, and they should have been scheduled, follow up and get them scheduled as soon as you can.',
  'Are there unconfirmed patients 48 hours out? If so, decide as a team what needs to be done. Do you make multiple calls for the next 48 hours until confirmed? Do you do nothing because a patient is known to be responsible and reliable? Do you double book? Each patient is different. Do not be afraid to call multiple times if a patient has cancelled before.',
  'Were there any last-minute calls from patients that led to changes in today\'s schedule?',
  'Do any of the day\'s patients have outstanding balances?',
  'Who are the new patients that day? Do you have the proper information about them?',
  'Is there any personal information about patients that should be known, i.e., upcoming vacations, birthdays, etc.?',
  'Are there any openings today in the doctor/hygiene schedule? What are the solutions?',
  'What is the financial information on today\'s patients? Are there financial arrangements needed? Does anyone have a poor payment history?',
  'Did any patients leave the office yesterday without paying their balance in full?',
  'Which patient should receive a quality control survey today?',
];

const BACK_OFFICE_ITEMS = [
  'Is there enough time scheduled for each procedure?',
  'Are there adequate supplies available?',
  'Do you need premedication information about a patient or any other pertinent medical info, such as allergies?',
  'Do any patients need additional x rays?',
  'Is there any pending treatment for any of today\'s patients that can be added to the schedule to fill in for cancellations or no-shows if needed?',
  'When can emergencies be scheduled?',
  'Have all lab cases for the day been checked in?',
  'Are photos needed for any patients?',
  'Are any family members overdue for recare?',
];

export const huddleService = {
  // Get or create today's huddle for an office
  async getOrCreateTodayHuddle(officeId, userId) {
    const today = new Date()?.toISOString()?.split('T')?.[0];
    return this.getOrCreateHuddleForDate(officeId, userId, today);
  },

  // Get or create a huddle for any specific date (past or present)
  async getOrCreateHuddleForDate(officeId, userId, date) {
    const { data: existing, error: fetchError } = await supabase?.from('huddles')?.select('*')?.eq('office_id', officeId)?.eq('huddle_date', date)?.maybeSingle();

    if (fetchError && fetchError?.code !== 'PGRST116') throw fetchError;
    if (existing) return existing;

    // Create new huddle for the given date
    const { data: newHuddle, error: createError } = await supabase?.from('huddles')?.insert({
        office_id: officeId,
        huddle_date: date,
        status: 'draft',
        created_by: userId,
      })?.select()?.single();

    if (createError?.code === '23505') {
      const { data: concurrentHuddle, error: retryError } = await supabase?.from('huddles')?.select('*')?.eq('office_id', officeId)?.eq('huddle_date', date)?.maybeSingle();
      if (retryError) throw retryError;
      if (concurrentHuddle) return concurrentHuddle;
    }
    if (createError) throw createError;

    // Create default provider blocks — 2 doctor + 2 hygienist (block_order 1–4)
    // Do not delete old block_order 5–6 historical data; new huddles use 1–4 only
    const blocks = [
      { huddle_id: newHuddle?.id, block_order: 1, block_type: 'doctor', provider_name: '' },
      { huddle_id: newHuddle?.id, block_order: 2, block_type: 'doctor', provider_name: '' },
      { huddle_id: newHuddle?.id, block_order: 3, block_type: 'hygienist', provider_name: '' },
      { huddle_id: newHuddle?.id, block_order: 4, block_type: 'hygienist', provider_name: '' },
    ];
    await supabase?.from('huddle_provider_blocks')?.insert(blocks);

    // Create default checklist items using exact Dr. G wording
    const checklistItems = [
      ...FRONT_DESK_ITEMS?.map((text, i) => ({
        huddle_id: newHuddle?.id,
        section: 'front_desk', item_number: i + 1, item_text: text, completed: false, notes: '',
      })),
      ...BACK_OFFICE_ITEMS?.map((text, i) => ({
        huddle_id: newHuddle?.id,
        section: 'back_office', item_number: i + 1, item_text: text, completed: false, notes: '',
      })),
    ];
    await supabase?.from('huddle_checklist_items')?.insert(checklistItems);

    // Log creation
    await supabase?.from('huddle_audit_log')?.insert({
      huddle_id: newHuddle?.id,
      action_type: 'create', changed_by: userId, reason: 'Huddle created',
      diff_summary: `New huddle created for ${date}`,
    });

    return newHuddle;
  },

  // Get full huddle with all related data
  async getHuddleById(huddleId) {
    const { data: huddle, error } = await supabase?.from('huddles')?.select('*')?.eq('id', huddleId)?.single();
    if (error) throw error;

    const { data: blocks } = await supabase?.from('huddle_provider_blocks')?.select('*')?.eq('huddle_id', huddleId)?.order('block_order');

    const { data: checklist } = await supabase?.from('huddle_checklist_items')?.select('*')?.eq('huddle_id', huddleId)?.order('item_number');
    const { data: linkedTasks } = await supabase?.from('action_items')?.select('checklist_item_id')?.eq('huddle_id', huddleId);
    const taskItemIds = new Set((linkedTasks || []).map(task => task.checklist_item_id));

    return {
      ...huddle,
      providerBlocks: blocks || [],
      checklistItems: (checklist || []).map(item => ({ ...item, has_task: taskItemIds.has(item.id) })),
    };
  },

  // Update huddle main fields
  async updateHuddle(huddleId, updates, userId) {
    const { data, error } = await supabase?.from('huddles')?.update({ ...updates, updated_at: new Date()?.toISOString() })?.eq('id', huddleId)?.select()?.single();
    if (error) throw error;

    await supabase?.from('huddle_audit_log')?.insert({
      huddle_id: huddleId,
      action_type: 'edit',
      changed_by: userId,
      reason: 'Huddle updated',
      diff_summary: JSON.stringify(updates),
    });

    return data;
  },

  // Update a provider block
  async updateProviderBlock(blockId, updates) {
    const { data, error } = await supabase?.from('huddle_provider_blocks')?.update({ ...updates, updated_at: new Date()?.toISOString() })?.eq('id', blockId)?.select()?.single();
    if (error) throw error;
    return data;
  },

  // Update a checklist item
  async updateChecklistItem(itemId, updates) {
    const { data, error } = await supabase?.from('huddle_checklist_items')?.update({ ...updates, updated_at: new Date()?.toISOString() })?.eq('id', itemId)?.select()?.single();
    if (error) throw error;
    return data;
  },

  // Submit huddle — creates approval request visible to admins/regional managers
  async submitHuddle(huddleId, userId) {
    const { data, error } = await supabase?.from('huddles')?.update({
        status: 'submitted',
        submitted_by: userId,
        submitted_at: new Date()?.toISOString(),
        updated_at: new Date()?.toISOString(),
      })?.eq('id', huddleId)?.in('status', ['unlocked', 'draft'])?.select('*, offices(name)')?.single();
    if (error) throw error;

    await supabase?.from('huddle_audit_log')?.insert({
      huddle_id: huddleId,
      action_type: 'submit',
      changed_by: userId,
      reason: 'Huddle submitted',
      diff_summary: 'Status changed to submitted — pending admin review',
    });

    // Log to notification_events so admins/regional managers see it in their notification center
    try {
      await supabase?.from('notification_events')?.insert({
        event_type: 'huddle_submitted',
        reference_id: huddleId,
        reference_table: 'huddles',
        triggered_by: userId,
        payload: { huddle_id: huddleId, status: 'submitted' },
      });
    } catch (notifErr) {
      // Non-blocking — submission still succeeds even if notification fails
      console.warn('[huddleService.submitHuddle] notification_events insert failed:', notifErr?.message);
    }

    // Send email notification to admins and regional managers via Resend
    try {
      const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
      const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

      // Fetch submitter name
      let submitterName = 'Unknown';
      try {
        const { data: profile } = await supabase?.from('user_profiles')?.select('full_name')?.eq('id', userId)?.maybeSingle();
        submitterName = profile?.full_name || 'Unknown';
      } catch (_) {}

      const officeName = data?.offices?.name || 'Unknown Office';
      const huddleDate = data?.huddle_date
        ? new Date(data.huddle_date)?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';
      const dueDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)?.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });

      // Fetch admin + regional manager emails
      const { data: approvers } = await supabase
        ?.from('user_profiles')
        ?.select('email')
        ?.in('role', ['admin', 'super_admin', 'regional_manager', 'regional_clinical_manager'])
        ?.eq('is_active', true);

      const recipients = (approvers || [])?.map(a => a?.email)?.filter(Boolean);

      await fetch(`${SUPABASE_URL}/functions/v1/huddle-approval-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          submitter_name: submitterName,
          office_name: officeName,
          huddle_date: huddleDate,
          due_date: dueDate,
          huddle_id: huddleId,
          recipients,
        }),
      });
    } catch (emailErr) {
      // Non-blocking — submission still succeeds even if email fails
      console.warn('[huddleService.submitHuddle] approval email failed:', emailErr?.message);
    }

    return data;
  },

  // Unlock huddle (admin/super_admin only)
  async unlockHuddle(huddleId, userId, reason) {
    const { data, error } = await supabase?.from('huddles')?.update({
        status: 'unlocked',
        updated_at: new Date()?.toISOString(),
      })?.eq('id', huddleId)?.select()?.single();
    if (error) throw error;

    await supabase?.from('huddle_audit_log')?.insert({
      huddle_id: huddleId,
      action_type: 'unlock',
      changed_by: userId,
      reason,
      diff_summary: 'Status changed to unlocked for audit',
    });

    return data;
  },

  // Get huddle history for an office (supports both legacy and object-based call signatures)
  async getHuddleHistory(officeIdOrOptions, limit = 30) {
    // Support object-based call: { officeIds, startDate, endDate, status, page, pageSize }
    if (officeIdOrOptions && typeof officeIdOrOptions === 'object' && !Array.isArray(officeIdOrOptions)) {
      const { officeIds = [], startDate, endDate, status, page = 1, pageSize = 20 } = officeIdOrOptions;

      let query = supabase
        ?.from('huddles')
        ?.select('*, offices(name)', { count: 'exact' })
        ?.order('huddle_date', { ascending: false });

      if (officeIds?.length > 0) {
        query = query?.in('office_id', officeIds);
      }
      if (startDate) query = query?.gte('huddle_date', startDate);
      if (endDate) query = query?.lte('huddle_date', endDate);
      if (status) query = query?.eq('status', status);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query?.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        console.error('[huddleService.getHuddleHistory] query error:', error?.message);
        throw error;
      }
      return { data: data || [], count: count || 0 };
    }

    // Legacy call: getHuddleHistory(officeId, limit)
    const officeId = officeIdOrOptions;
    if (!officeId) return { data: [], count: 0 };

    const { data, error } = await supabase
      ?.from('huddles')
      ?.select('*, offices(name)')
      ?.eq('office_id', officeId)
      ?.order('huddle_date', { ascending: false })
      ?.limit(limit);
    if (error) {
      console.error('[huddleService.getHuddleHistory] legacy query error:', error?.message);
      throw error;
    }
    return data || [];
  },

  // Get huddle history for super_admin (all offices)
  async getAllHuddleHistory(limit = 50) {
    const { data, error } = await supabase?.from('huddles')?.select('*, offices(name)')?.order('huddle_date', { ascending: false })?.limit(limit);
    if (error) throw error;
    return data || [];
  },

  // Get audit log for a huddle
  async getAuditLog(huddleId) {
    const { data, error } = await supabase?.from('huddle_audit_log')?.select('*, user_profiles(full_name, email)')?.eq('huddle_id', huddleId)?.order('changed_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Analytics: get huddles for date range
  async getHuddlesForAnalytics(officeId, startDate, endDate) {
    let query = supabase?.from('huddles')?.select('*, offices(name), huddle_provider_blocks(*), huddle_checklist_items(*)')?.gte('huddle_date', startDate)?.lte('huddle_date', endDate)?.order('huddle_date', { ascending: true });

    if (officeId) {
      query = query?.eq('office_id', officeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
};

export default huddleService;
