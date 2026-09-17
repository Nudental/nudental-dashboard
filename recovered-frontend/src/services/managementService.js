import { supabase, createUserInvitationClient } from '../lib/supabase';
import { readCompleteAuditEntries } from './auditReadService';

// ─── DIFF LOGIC ────────────────────────────────────────────────────────────
const IGNORED_DIFF_KEYS = ['updated_at', 'created_at', 'id'];

const buildChangeSummary = (tableName, action, oldValues, newValues, recordName) => {
  if (action === 'CREATE') return `Created new ${tableName?.replace(/_/g, ' ')} record${recordName ? `: ${recordName}` : ''}`;
  if (action === 'SOFT_DELETE') return `Deleted ${recordName || 'record'} from ${tableName?.replace(/_/g, ' ')}`;
  if (action === 'INVITE') return `Invited new user: ${recordName || ''}`;
  if (action === 'APPROVE') return `Approved user account: ${recordName || ''}`;
  if (action === 'DEACTIVATE') return `Deactivated user account: ${recordName || ''}`;

  if (!oldValues || !newValues) return `${action} on ${tableName}`;

  const changes = [];
  const allKeys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);

  for (const key of allKeys) {
    if (IGNORED_DIFF_KEYS?.includes(key)) continue;
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      const label = key?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase());
      if (key === 'is_active') {
        changes?.push(`Changed ${recordName || 'record'} status to ${newVal ? 'Active' : 'Inactive'}`);
      } else if (key === 'status') {
        changes?.push(`Changed ${recordName || 'record'} account status to ${newVal}`);
      } else {
        changes?.push(`Changed ${label} from "${oldVal ?? '—'}" to "${newVal ?? '—'}"`);
      }
    }
  }

  return changes?.length > 0 ? changes?.join('; ') : `Updated ${recordName || tableName?.replace(/_/g, ' ')}`;
};

// Audit logging helper
const logAudit = async (action, tableName, recordId, oldValues = null, newValues = null, recordName = '') => {
  try {
    const { data: { user } } = await supabase?.auth?.getUser();
    if (!user) return;
    const changeSummary = buildChangeSummary(tableName, action, oldValues, newValues, recordName);
    await supabase?.from('audit_logs')?.insert({
      user_id: user?.id,
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      change_summary: changeSummary,
    });
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

// ─── PROFILE PHOTOS STORAGE ────────────────────────────────────────────────
export const profilePhotosService = {
  async upload(userId, file) {
    const ext = file?.name?.split('.')?.pop();
    const filePath = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase?.storage?.from('profile-photos')?.upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });
    if (error) throw error;
    return filePath;
  },

  async getSignedUrl(filePath) {
    if (!filePath) return null;
    const { data, error } = await supabase?.storage?.from('profile-photos')?.createSignedUrl(filePath, 3600);
    if (error) return null;
    return data?.signedUrl;
  },

  async remove(filePath) {
    if (!filePath) return;
    await supabase?.storage?.from('profile-photos')?.remove([filePath]);
  },
};

// ─── OFFICES ───────────────────────────────────────────────────────────────
export const officesService = {
  async getAll() {
    const { data, error } = await supabase?.from('offices')?.select('*')?.order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const { data, error } = await supabase?.from('offices')?.insert(payload)?.select()?.single();
    if (error) throw error;
    await logAudit('CREATE', 'offices', data?.id, null, data, data?.name);
    return data;
  },

  async update(id, payload) {
    const { data: old } = await supabase?.from('offices')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('offices')?.update(payload)?.eq('id', id)?.select()?.single();
    if (error) throw error;
    await logAudit('UPDATE', 'offices', id, old, data, old?.name);
    return data;
  },

  async toggleActive(id, isActive) {
    const { data: old } = await supabase?.from('offices')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('offices')?.update({ is_active: isActive })?.eq('id', id)?.select()?.single();
    if (error) throw error;
    await logAudit('TOGGLE_ACTIVE', 'offices', id, old, data, old?.name);
    return data;
  },

  async delete(id) {
    const { data: old } = await supabase?.from('offices')?.select('*')?.eq('id', id)?.single();
    const { error } = await supabase?.from('offices')?.update({ is_active: false })?.eq('id', id);
    if (error) throw error;
    await logAudit('SOFT_DELETE', 'offices', id, old, { is_active: false }, old?.name);
  },
};

// ─── PROVIDERS ─────────────────────────────────────────────────────────────
export const providersService = {
  async getAll() {
    const { data, error } = await supabase?.from('providers')?.select('*, offices(name)')?.order('name', { ascending: true });
    if (error) throw error;
    return (data || [])?.map(p => ({
      ...p,
      officeName: p?.offices?.name || '',
    }));
  },

  async create(payload) {
    const { data, error } = await supabase?.from('providers')?.insert(payload)?.select()?.single();
    if (error) throw error;
    await logAudit('CREATE', 'providers', data?.id, null, data, data?.name);
    return data;
  },

  async update(id, payload) {
    const { data: old } = await supabase?.from('providers')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('providers')?.update(payload)?.eq('id', id)?.select()?.single();
    if (error) throw error;
    await logAudit('UPDATE', 'providers', id, old, data, old?.name);
    return data;
  },

  async toggleActive(id, isActive) {
    const { data: old } = await supabase?.from('providers')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('providers')?.update({ is_active: isActive })?.eq('id', id)?.select()?.single();
    if (error) throw error;
    await logAudit('TOGGLE_ACTIVE', 'providers', id, old, data, old?.name);
    return data;
  },

  async delete(id) {
    const { data: old } = await supabase?.from('providers')?.select('*')?.eq('id', id)?.single();
    const { error } = await supabase?.from('providers')?.update({ is_active: false })?.eq('id', id);
    if (error) throw error;
    await logAudit('SOFT_DELETE', 'providers', id, old, { is_active: false }, old?.name);
  },

  async hardDelete(id) {
    const { data: old } = await supabase?.from('providers')?.select('*')?.eq('id', id)?.single();
    const { error } = await supabase?.from('providers')?.delete()?.eq('id', id);
    if (error) throw error;
    await logAudit('HARD_DELETE', 'providers', id, old, null, old?.name);
  },
};

// ─── USERS & STAFF ─────────────────────────────────────────────────────────
export const usersService = {
  async getAll() {
    const { data, error } = await supabase?.from('user_profiles')?.select('*, offices(name)')?.order('full_name', { ascending: true });
    if (error) throw error;
    return (data || [])?.map(u => ({
      ...u,
      officeName: u?.offices?.name || '',
    }));
  },

  async invite(payload) {
    // Validate username uniqueness before creating auth user
    if (payload?.username) {
      const { data: existingUser } = await supabase
        ?.from('user_profiles')
        ?.select('id')
        ?.ilike('username', payload?.username?.trim())
        ?.maybeSingle();
      if (existingUser) throw new Error(`Username "${payload?.username}" is already taken. Please choose a different username.`);
    }

    // Use provided tempPassword or generate one
    const tempPassword = payload?.tempPassword?.trim() || (crypto.randomUUID() + 'Aa1!');

    // Signup must not replace the administrator session used for the profile write.
    const { data: signUpData, error: signUpError } = await createUserInvitationClient().auth.signUp({
      email: payload?.email,
      password: tempPassword,
      options: {
        data: { full_name: payload?.fullName, role: payload?.role },
        emailRedirectTo: `${window.location?.origin}/reset-password`,
      },
    });

    if (signUpError) throw signUpError;

    const authUserId = signUpData?.user?.id;
    if (!authUserId) throw new Error('Failed to create auth user — no user ID returned.');

    const { data: profile, error: profileError } = await supabase?.from('user_profiles')?.upsert({
      id: authUserId,
      email: payload?.email,
      full_name: payload?.fullName,
      role: payload?.role,
      username: payload?.username?.trim()?.toLowerCase() || null,
      phone: payload?.phone?.trim() || null,
      is_active: true,
      is_approved: true,
      status: 'Active',
      must_change_password: true,
    }, { onConflict: 'id' })?.select()?.single();

    if (profileError) throw profileError;
    await logAudit('INVITE', 'user_profiles', authUserId, null, profile, profile?.full_name);
    return profile;
  },

  async update(id, payload) {
    // If username is being updated, check uniqueness
    if (payload?.username) {
      const { data: existingUser } = await supabase
        ?.from('user_profiles')
        ?.select('id')
        ?.ilike('username', payload?.username?.trim())
        ?.neq('id', id)
        ?.maybeSingle();
      if (existingUser) throw new Error(`Username "${payload?.username}" is already taken.`);
    }
    const { data: old } = await supabase?.from('user_profiles')?.select('*')?.eq('id', id)?.single();
    const updatePayload = { ...payload };
    if (updatePayload?.username) updatePayload.username = updatePayload?.username?.trim()?.toLowerCase();
    const { data, error } = await supabase?.from('user_profiles')?.update(updatePayload)?.eq('id', id)?.select()?.single();
    if (error) throw error;
    await logAudit('UPDATE', 'user_profiles', id, old, data, old?.full_name);
    return data;
  },

  async toggleActive(id, isActive) {
    const { data: old } = await supabase?.from('user_profiles')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('user_profiles')?.update({
      is_active: isActive, is_approved: isActive, status: isActive ? 'Active' : 'Deactivated',
    })?.eq('id', id)?.select()?.single();
    if (error) throw error;
    await logAudit('TOGGLE_ACTIVE', 'user_profiles', id, old, data, old?.full_name);
    return data;
  },

  async approveUser(id) {
    const { data: old } = await supabase?.from('user_profiles')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('user_profiles')
      ?.update({ is_approved: true, status: 'Active', is_active: true })
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    await logAudit('APPROVE', 'user_profiles', id, old, data, old?.full_name);
    return data;
  },

  async deactivateUser(id) {
    const { data: old } = await supabase?.from('user_profiles')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('user_profiles')
      ?.update({ is_approved: false, status: 'Deactivated', is_active: false })
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    await logAudit('DEACTIVATE', 'user_profiles', id, old, data, old?.full_name);
    return data;
  },

  async delete(id) {
    const { data: old } = await supabase?.from('user_profiles')?.select('*')?.eq('id', id)?.single();
    const { error } = await supabase?.from('user_profiles')?.update({ is_active: false, status: 'Deactivated', is_approved: false })?.eq('id', id);
    if (error) throw error;
    await logAudit('SOFT_DELETE', 'user_profiles', id, old, { is_active: false, status: 'Deactivated' }, old?.full_name);
  },
};

// ─── COST DRIVERS ──────────────────────────────────────────────────────────
export const costDriversService = {
  async getAll() {
    const { data, error } = await supabase?.from('cost_drivers')?.select('*, offices(name)')?.order('name', { ascending: true });
    if (error) throw error;
    return (data || [])?.map(d => ({
      ...d,
      officeName: d?.offices?.name || '',
    }));
  },

  async getByOffice(officeId) {
    const { data, error } = await supabase?.from('cost_drivers')?.select('*, offices(name)')?.eq('office_id', officeId)?.eq('is_active', true)?.order('name', { ascending: true });
    if (error) throw error;
    return (data || [])?.map(d => ({
      ...d,
      officeName: d?.offices?.name || '',
    }));
  },

  async create(payload) {
    const { data, error } = await supabase?.from('cost_drivers')?.insert(payload)?.select()?.single();
    if (error) throw error;
    await logAudit('CREATE', 'cost_drivers', data?.id, null, data, data?.name);
    return data;
  },

  async update(id, payload) {
    const { data: old } = await supabase?.from('cost_drivers')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('cost_drivers')?.update(payload)?.eq('id', id)?.select()?.single();
    if (error) throw error;
    await logAudit('UPDATE', 'cost_drivers', id, old, data, old?.name);
    return data;
  },

  async delete(id) {
    const { data: old } = await supabase?.from('cost_drivers')?.select('*')?.eq('id', id)?.single();
    const { error } = await supabase?.from('cost_drivers')?.update({ is_active: false })?.eq('id', id);
    if (error) throw error;
    await logAudit('SOFT_DELETE', 'cost_drivers', id, old, { is_active: false }, old?.name);
  },
};

// ─── BACK STAFF ORDERS ─────────────────────────────────────────────────────
export const backStaffOrdersService = {
  async getAll() {
    const { data, error } = await supabase?.from('back_staff_orders')?.select('*, offices(name)')?.order('name', { ascending: true });
    if (error) throw error;
    return (data || [])?.map(d => ({
      ...d,
      officeName: d?.offices?.name || '',
    }));
  },

  async getByOffice(officeId) {
    const { data, error } = await supabase?.from('back_staff_orders')?.select('*, offices(name)')?.eq('office_id', officeId)?.eq('is_active', true)?.order('name', { ascending: true });
    if (error) throw error;
    return (data || [])?.map(d => ({
      ...d,
      officeName: d?.offices?.name || '',
    }));
  },

  async create(payload) {
    const { data, error } = await supabase?.from('back_staff_orders')?.insert(payload)?.select()?.single();
    if (error) throw error;
    await logAudit('CREATE', 'back_staff_orders', data?.id, null, data, data?.name);
    return data;
  },

  async update(id, payload) {
    const { data: old } = await supabase?.from('back_staff_orders')?.select('*')?.eq('id', id)?.single();
    const { data, error } = await supabase?.from('back_staff_orders')?.update(payload)?.eq('id', id)?.select()?.single();
    if (error) throw error;
    await logAudit('UPDATE', 'back_staff_orders', id, old, data, old?.name);
    return data;
  },

  async delete(id) {
    const { data: old } = await supabase?.from('back_staff_orders')?.select('*')?.eq('id', id)?.single();
    const { error } = await supabase?.from('back_staff_orders')?.update({ is_active: false })?.eq('id', id);
    if (error) throw error;
    await logAudit('SOFT_DELETE', 'back_staff_orders', id, old, { is_active: false }, old?.name);
  },
};

// ─── AUDIT LOGS ────────────────────────────────────────────────────────────
export const auditLogsService = {
  async getAll() {
    const data = await readCompleteAuditEntries((from, to) => supabase
      .from('audit_logs')
      .select('*, user_profiles(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to));
    return data.map(log => ({
      ...log,
      userName: log?.user_profiles?.full_name || log?.user_profiles?.email || 'Unknown',
    }));
  },
};
