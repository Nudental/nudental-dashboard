import { supabase } from '../lib/supabase';
import { dashboardEnvironment } from '../config/dashboardEnvironment';

const APP_URL = 'https://nudentalr1699.builtwithrocket.new';

const ROLE_LABELS = {
  staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
  doctor: 'Doctor',
};

import { OFFICE_MAP } from '../constants/offices';

// Call the send-email edge function
const callSendEmail = async (emailType, recipientEmail, recipientName, data = {}) => {
  try {
    const { data: result, error } = await supabase?.functions?.invoke('send-email', {
      body: {
        email_type: emailType,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        data: { ...data, app_url: APP_URL },
      },
    });

    if (error) throw error;
    return { success: true, data: result };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: err?.message || 'Failed to send email' };
  }
};

// Log email event to database
const logEmailEvent = async (recipientEmail, recipientName, emailType, subject, status, errorMessage = '', metadata = {}) => {
  try {
    const { data: { user } } = await supabase?.auth?.getUser();
    await supabase?.from('email_logs')?.insert({
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      email_type: emailType,
      subject,
      status,
      error_message: errorMessage,
      triggered_by: user?.id || null,
      metadata,
    });
  } catch (err) {
    console.error('Email log error:', err);
  }
};

export const emailService = {
  // Send welcome email on account creation
  async sendWelcomeEmail(user) {
    const { email, full_name, role, office_name, set_password_url } = user;
    const result = await callSendEmail('welcome', email, full_name, {
      email,
      full_name,
      role_label: ROLE_LABELS?.[role] || role,
      office_name: office_name || '',
      set_password_url: set_password_url || `${APP_URL}/login`,
    });
    await logEmailEvent(
      email,
      full_name,
      'welcome',
      `Welcome to NU Dental Portal — ${full_name}`,
      result?.success ? 'sent' : 'failed',
      result?.error || '',
      { role, office_name }
    );
    return result;
  },

  // Send password reset email
  async sendPasswordResetEmail(user, resetUrl) {
    const { email, full_name } = user;
    const result = await callSendEmail('password_reset', email, full_name, {
      full_name,
      reset_url: resetUrl,
    });
    await logEmailEvent(
      email,
      full_name,
      'password_reset',
      'Reset Your NU Dental Portal Password',
      result?.success ? 'sent' : 'failed',
      result?.error || ''
    );
    return result;
  },

  // Send entry submitted notification to reviewer
  async sendEntrySubmittedEmail(reviewer, entryDetails) {
    const { email, full_name } = reviewer;
    const result = await callSendEmail('entry_submitted', email, full_name, {
      reviewer_name: full_name,
      entry_date: entryDetails?.entry_date,
      office_name: entryDetails?.office_name,
      submitted_by: entryDetails?.submitted_by,
      review_url: `${APP_URL}/daily-entry-form`,
    });
    await logEmailEvent(
      email,
      full_name,
      'entry_submitted',
      `Entry Submitted for Review — ${entryDetails?.office_name}`,
      result?.success ? 'sent' : 'failed',
      result?.error || '',
      entryDetails
    );
    return result;
  },

  // Send entry approved notification
  async sendEntryApprovedEmail(user, entryDetails) {
    const { email, full_name } = user;
    const result = await callSendEmail('entry_approved', email, full_name, {
      full_name,
      entry_date: entryDetails?.entry_date,
      office_name: entryDetails?.office_name,
      approved_by: entryDetails?.approved_by,
      entry_url: `${APP_URL}/daily-entry-form`,
    });
    await logEmailEvent(
      email,
      full_name,
      'entry_approved',
      `Entry Approved — ${entryDetails?.office_name}`,
      result?.success ? 'sent' : 'failed',
      result?.error || '',
      entryDetails
    );
    return result;
  },

  // Send entry rejected notification
  async sendEntryRejectedEmail(user, entryDetails) {
    const { email, full_name } = user;
    const result = await callSendEmail('entry_rejected', email, full_name, {
      full_name,
      entry_date: entryDetails?.entry_date,
      office_name: entryDetails?.office_name,
      reviewed_by: entryDetails?.reviewed_by,
      rejection_reason: entryDetails?.rejection_reason || '',
      entry_url: `${APP_URL}/daily-entry-form`,
    });
    await logEmailEvent(
      email,
      full_name,
      'entry_rejected',
      `Entry Needs Revision — ${entryDetails?.office_name}`,
      result?.success ? 'sent' : 'failed',
      result?.error || '',
      entryDetails
    );
    return result;
  },

  // Send entry needs review notification
  async sendEntryNeedsReviewEmail(reviewer, entryDetails) {
    const { email, full_name } = reviewer;
    const result = await callSendEmail('entry_needs_review', email, full_name, {
      reviewer_name: full_name,
      entry_date: entryDetails?.entry_date,
      office_name: entryDetails?.office_name,
      submitted_by: entryDetails?.submitted_by,
      flag_reason: entryDetails?.flag_reason || '',
      review_url: `${APP_URL}/daily-entry-form`,
    });
    await logEmailEvent(
      email,
      full_name,
      'entry_needs_review',
      `Entry Flagged for Review — ${entryDetails?.office_name}`,
      result?.success ? 'sent' : 'failed',
      result?.error || '',
      entryDetails
    );
    return result;
  },

  // Get email logs for admin visibility
  async getEmailLogs({ limit = 100, offset = 0, status = null, email_type = null } = {}) {
    let query = supabase?.from('email_logs')?.select('*')?.order('created_at', { ascending: false })?.range(offset, offset + limit - 1);

    if (status) query = query?.eq('status', status);
    if (email_type) query = query?.eq('email_type', email_type);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Send insurance verification notification to Yabezy and Admasu
  async sendInsuranceVerificationNotification(formData = {}) {
    const patientName =
      formData?.patient_name ||
      formData?.patientName ||
      formData?.name ||
      formData?.full_name ||
      formData?.fullName ||
      'Unknown Patient';

    try {
      const { data: result, error } = await supabase?.functions?.invoke('insurance-verify-notification', {
        body: formData,
      });
      if (error) throw error;

      // Log for each recipient
      const recipients = ['Yabezy@thenudental.com', 'admasu@thenudental.com'];
      for (const email of recipients) {
        await logEmailEvent(
          email,
          patientName,
          'insurance_verification',
          `${patientName} – New Verification Request`,
          'sent',
          '',
          formData
        );
      }
      return { success: true, data: result };
    } catch (err) {
      console.error('Insurance verification email error:', err);
      return { success: false, error: err?.message || 'Failed to send email' };
    }
  },
};

export const rolePermissionsService = {
  async getAll() {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        ?.from('role_permissions')
        ?.select('*')
        ?.order('role', { ascending: true })
        ?.order('permission', { ascending: true })
        ?.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = data || [];
      allRows = allRows?.concat(page);
      hasMore = page?.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[rolePermissionsService] getAll() fetched ${allRows?.length} total rows`);
    }
    return allRows;
  },

  async updatePermission(role, permission, enabled) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const { data, error } = await supabase?.from('role_permissions')?.upsert(
        { role, permission, enabled, updated_by: user?.id, updated_at: new Date()?.toISOString() },
        { onConflict: 'role,permission' }
      )?.select()?.single();
    if (error) throw error;
    return data;
  },

  async saveRolePermissions(role, permissions) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const upserts = Object.entries(permissions)?.map(([permission, enabled]) => ({
      role,
      permission,
      enabled,
      updated_by: user?.id,
      updated_at: new Date()?.toISOString(),
    }));
    const { data, error } = await supabase?.from('role_permissions')?.upsert(upserts, { onConflict: 'role,permission' })?.select();
    if (error) throw error;
    return data;
  },

  async logPermissionChanges({ actorId, targetRole, changedKeys, saveBatchId, source = 'role_editor' }) {
    if (!changedKeys?.length) return;
    const rows = changedKeys?.map(({ id, before, after }) => ({
      actor_id: actorId || null,
      target_role: targetRole,
      permission_key: id,
      old_enabled: before === true || before === false ? before : null,
      new_enabled: after === true,
      source,
      save_batch_id: saveBatchId,
    }));
    const { error } = await supabase?.from('role_permission_audit_log')?.insert(rows);
    if (error) throw error;
  },
};

export const userOfficeService = {
  async getUserOfficeAssignments(userId) {
    const { data, error } = await supabase?.from('user_office_assignments')?.select('*, offices(id, name)')?.eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async setUserOfficeAssignments(userId, officeIds, allOffices = false) {
    // ── V685: Fetch current assignments before making changes ──────────────
    let previousAssignments = [];
    try {
      const { data: prevData } = await supabase
        ?.from('user_office_assignments')
        ?.select('id, office_id, all_offices, offices(id, name)')
        ?.eq('user_id', userId);
      previousAssignments = prevData || [];
    } catch (_) {
      // Non-blocking: proceed even if pre-fetch fails
    }

    if (dashboardEnvironment.isQa) {
      const { data, error } = await supabase.rpc('dashboard_set_user_offices', {
        p_user_id: userId, p_office_ids: officeIds || [], p_all_offices: allOffices,
      });
      if (error) throw error;
      await logOfficeAssignmentAudit(userId, previousAssignments, data || [], allOffices, officeIds || []);
      return;
    }

    // Delete existing assignments
    await supabase?.from('user_office_assignments')?.delete()?.eq('user_id', userId);

    let insertedData = null;
    if (allOffices) {
      // Insert a single all_offices=true record
      const { data, error } = await supabase?.from('user_office_assignments')?.insert({
        user_id: userId,
        office_id: null,
        all_offices: true,
      })?.select();
      if (error) throw error;
      insertedData = data;
    } else if (officeIds?.length > 0) {
      const inserts = officeIds?.map((officeId) => ({
        user_id: userId,
        office_id: officeId,
        all_offices: false,
      }));
      const { data, error } = await supabase?.from('user_office_assignments')?.insert(inserts)?.select();
      if (error) throw error;
      insertedData = data;
    }

    // ── V685: Write audit row after successful assignment update ───────────
    try {
      await logOfficeAssignmentAudit(userId, previousAssignments, insertedData || [], allOffices, officeIds || []);
    } catch (auditErr) {
      console.warn('[userOfficeService] Audit log error (non-blocking):', auditErr?.message);
    }
  },

  async getAllUsersWithOffices() {
    const { data, error } = await supabase?.from('user_profiles')?.select('*, user_office_assignments(office_id, all_offices, offices(id, name))')?.order('full_name', { ascending: true });
    if (error) throw error;
    return (data || [])?.map((u) => ({
      ...u,
      officeAssignments: u?.user_office_assignments || [],
      hasAllOffices: u?.user_office_assignments?.some((a) => a?.all_offices) || false,
      assignedOfficeNames: u?.user_office_assignments
        ?.filter((a) => !a?.all_offices && a?.offices)
        ?.map((a) => a?.offices?.name)
        ?.join(', ') || '',
    }));
  },
};

// ── V685: Resolve a readable office name from id ───────────────────────────
const resolveOfficeName = (officeId, officesJoin) => {
  if (!officeId) return null;
  // Try the joined offices object first (from select with join)
  if (officesJoin?.name) return officesJoin?.name;
  // Fall back to OFFICE_MAP constant
  return OFFICE_MAP?.[officeId]?.name || officeId;
};

// ── V685: Build a human-readable change summary ────────────────────────────
const buildOfficeAssignmentChangeSummary = (targetUserId, previousAssignments, newOfficeIds, newAllOffices, targetUserName) => {
  const userLabel = targetUserName || `user ${targetUserId}`;

  if (newAllOffices) {
    const hadAllOffices = previousAssignments?.some((a) => a?.all_offices);
    if (hadAllOffices) {
      return `Office assignments unchanged for ${userLabel}: All Offices (no change)`;
    }
    const prevNames = previousAssignments
      ?.filter((a) => !a?.all_offices && a?.office_id)
      ?.map((a) => resolveOfficeName(a?.office_id, a?.offices))
      ?.filter(Boolean)
      ?.join(', ') || 'none';
    return `Updated office assignments for ${userLabel}: removed [${prevNames}], granted All Offices access`;
  }

  const prevIds = new Set(
    previousAssignments
      ?.filter((a) => !a?.all_offices && a?.office_id)
      ?.map((a) => a?.office_id)
  );
  const newIds = new Set(newOfficeIds || []);

  const added = [...newIds]?.filter((id) => !prevIds?.has(id));
  const removed = [...prevIds]?.filter((id) => !newIds?.has(id));

  const addedNames = added?.map((id) => OFFICE_MAP?.[id]?.name || id)?.join(', ');
  const removedNames = removed?.map((id) => {
    const prev = previousAssignments?.find((a) => a?.office_id === id);
    return resolveOfficeName(id, prev?.offices);
  })?.join(', ');

  if (added?.length === 0 && removed?.length === 0) {
    const currentNames = [...newIds]?.map((id) => OFFICE_MAP?.[id]?.name || id)?.join(', ') || 'none';
    return `Office assignments unchanged for ${userLabel}: [${currentNames}]`;
  }

  const parts = [];
  if (added?.length > 0) parts?.push(`added [${addedNames}]`);
  if (removed?.length > 0) parts?.push(`removed [${removedNames}]`);
  return `Updated office assignments for ${userLabel}: ${parts?.join(', ')}`;
};

// ── V685: Non-blocking audit log writer ────────────────────────────────────
const logOfficeAssignmentAudit = async (targetUserId, previousAssignments, newAssignments, newAllOffices, newOfficeIds) => {
  try {
    const { data: { user } } = await supabase?.auth?.getUser();
    if (!user) return;

    // Resolve target user name for the summary
    let targetUserName = null;
    try {
      const { data: profileData } = await supabase
        ?.from('user_profiles')
        ?.select('full_name, email')
        ?.eq('id', targetUserId)
        ?.maybeSingle();
      targetUserName = profileData?.full_name || profileData?.email || null;
    } catch (_) {
      // Non-blocking
    }

    // Build old_values: previous assignment ids and readable office names
    const oldValues = {
      user_id: targetUserId,
      all_offices: previousAssignments?.some((a) => a?.all_offices) || false,
      office_ids: previousAssignments?.filter((a) => !a?.all_offices && a?.office_id)?.map((a) => a?.office_id),
      office_names: previousAssignments?.some((a) => a?.all_offices)
        ? ['All Offices']
        : previousAssignments
            ?.filter((a) => !a?.all_offices && a?.office_id)
            ?.map((a) => resolveOfficeName(a?.office_id, a?.offices))
            ?.filter(Boolean),
    };

    // Build new_values: new assignment ids and readable office names
    const newValues = {
      user_id: targetUserId,
      all_offices: newAllOffices,
      office_ids: newAllOffices ? [] : (newOfficeIds || []),
      office_names: newAllOffices
        ? ['All Offices']
        : (newOfficeIds || [])?.map((id) => OFFICE_MAP?.[id]?.name || id),
    };

    const changeSummary = buildOfficeAssignmentChangeSummary(
      targetUserId,
      previousAssignments,
      newOfficeIds,
      newAllOffices,
      targetUserName
    );

    await supabase?.from('audit_logs')?.insert({
      user_id: user?.id,
      action: 'UPDATE_OFFICE_ASSIGNMENTS',
      table_name: 'user_office_assignments',
      record_id: targetUserId,
      old_values: oldValues,
      new_values: newValues,
      change_summary: changeSummary,
    });
  } catch (err) {
    console.warn('[userOfficeService] Audit log error (non-blocking):', err?.message);
  }
};
