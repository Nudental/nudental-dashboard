import { supabase } from '../lib/supabase';

const PHOTO_BUCKET = 'staff-directory-photos';
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Staff Directory Service — Phase 4A
 * Reads/writes exclusively from public.staff_directory.
 * Does NOT query providers, provider_master, or user_profiles for directory data.
 */
export const staffDirectoryService = {
  /**
   * Fetch staff from staff_directory with optional filters.
   */
  async getStaff({
    search = '',
    officeLocation = '',
    roleCategory = '',
    workerType = '',
    isActive = 'active',
    birthdayMonth = '',
  } = {}) {
    let query = supabase
      ?.from('staff_directory')
      ?.select(
        `id,
         directory_display_name,
         contact_list_employee_name,
         full_name,
         first_name,
         last_name,
         office_location_normalized,
         dashboard_office_name,
         job_title,
         role_category,
         worker_type,
         preferred_email,
         personal_email,
         work_email,
         phone,
         date_of_birth,
         is_active,
         employee_pronouns,
         imported_from,
         notes,
         photo_storage_path,
         photo_uploaded_at`
      )
      ?.order('full_name', { ascending: true });

    if (isActive === 'active') {
      query = query?.eq('is_active', true);
    } else if (isActive === 'inactive') {
      query = query?.eq('is_active', false);
    }

    if (officeLocation) {
      query = query?.eq('office_location_normalized', officeLocation);
    }

    if (roleCategory) {
      query = query?.eq('role_category', roleCategory);
    }

    if (workerType) {
      query = query?.eq('worker_type', workerType);
    }

    if (birthdayMonth) {
      query = query?.filter('date_of_birth', 'not.is', null);
    }

    const { data, error } = await query;
    if (error) throw error;

    let staff = data || [];

    if (birthdayMonth) {
      const month = parseInt(birthdayMonth, 10);
      staff = staff?.filter(s => {
        if (!s?.date_of_birth) return false;
        const d = new Date(s?.date_of_birth);
        return d?.getMonth() + 1 === month;
      });
    }

    if (search?.trim()) {
      const q = search?.trim()?.toLowerCase();
      staff = staff?.filter(s => {
        const name = (s?.directory_display_name || s?.full_name || '')?.toLowerCase();
        const altName = (s?.contact_list_employee_name || '')?.toLowerCase();
        const email = (s?.preferred_email || s?.work_email || s?.personal_email || '')?.toLowerCase();
        const phone = (s?.phone || '')?.toLowerCase();
        const title = (s?.job_title || '')?.toLowerCase();
        return (
          name?.includes(q) ||
          altName?.includes(q) ||
          email?.includes(q) ||
          phone?.includes(q) ||
          title?.includes(q)
        );
      });
    }

    return staff;
  },

  /**
   * Get distinct office locations for filter dropdown.
   */
  async getLocations() {
    const { data, error } = await supabase
      ?.from('staff_directory')
      ?.select('office_location_normalized')
      ?.eq('is_active', true)
      ?.order('office_location_normalized', { ascending: true });

    if (error) throw error;
    const unique = [...new Set((data || [])?.map(r => r?.office_location_normalized)?.filter(Boolean))];
    return unique;
  },

  /**
   * Get distinct role categories for filter dropdown.
   */
  async getRoleCategories() {
    const { data, error } = await supabase
      ?.from('staff_directory')
      ?.select('role_category')
      ?.eq('is_active', true)
      ?.order('role_category', { ascending: true });

    if (error) throw error;
    const unique = [...new Set((data || [])?.map(r => r?.role_category)?.filter(Boolean))];
    return unique;
  },

  /**
   * Group staff by office_location_normalized.
   */
  groupByLocation(staff) {
    const map = new Map();
    for (const s of staff) {
      const key = s?.office_location_normalized || 'Unassigned';
      if (!map?.has(key)) {
        map?.set(key, {
          location: key,
          dashboardName: s?.dashboard_office_name || key,
          staff: [],
        });
      }
      map?.get(key)?.staff?.push(s);
    }
    return Array.from(map?.values())?.sort((a, b) =>
      a?.location?.localeCompare(b?.location)
    );
  },

  /**
   * Compute summary counts from a staff array.
   */
  getSummary(staff) {
    const total = staff?.length;
    const locations = new Set(staff?.map(s => s?.office_location_normalized)?.filter(Boolean))?.size;
    const providers = staff?.filter(s =>
      ['Doctor/Dentist', 'Hygienist']?.includes(s?.role_category)
    )?.length;
    const managementAdmin = staff?.filter(s =>
      s?.role_category === 'Management/Admin'
    )?.length;
    const contractors = staff?.filter(s => s?.worker_type === 'Contractor')?.length;
    return { total, locations, providers, managementAdmin, contractors };
  },

  /**
   * Create a new staff_directory row.
   * Validates no duplicate full_name + office_location_normalized.
   */
  async createStaff(fields, changedBy) {
    // Duplicate check
    const { data: existing } = await supabase
      ?.from('staff_directory')
      ?.select('id')
      ?.eq('full_name', fields?.full_name?.trim())
      ?.eq('office_location_normalized', fields?.office_location_normalized?.trim())
      ?.limit(1);

    if (existing?.length > 0) {
      throw new Error(`A staff member named "${fields?.full_name}" already exists at ${fields?.office_location_normalized}.`);
    }

    const insertData = {
      full_name: fields?.full_name?.trim(),
      directory_display_name: fields?.directory_display_name?.trim() || fields?.full_name?.trim(),
      contact_list_employee_name: fields?.contact_list_employee_name?.trim() || null,
      office_location_normalized: fields?.office_location_normalized?.trim(),
      job_title: fields?.job_title?.trim() || null,
      role_category: fields?.role_category?.trim() || null,
      worker_type: fields?.worker_type?.trim() || null,
      preferred_email: fields?.preferred_email?.trim() || null,
      work_email: fields?.work_email?.trim() || null,
      personal_email: fields?.personal_email?.trim() || null,
      phone: fields?.phone?.trim() || null,
      date_of_birth: fields?.date_of_birth || null,
      notes: fields?.notes?.trim() || null,
      is_active: fields?.is_active !== undefined ? fields?.is_active : true,
      imported_from: 'manual',
    };

    const { data, error } = await supabase
      ?.from('staff_directory')
      ?.insert(insertData)
      ?.select()
      ?.single();

    if (error) throw error;

    // Audit log
    await staffDirectoryService?.logAudit({
      staffId: data?.id,
      action: 'create',
      changedBy,
      changedFields: insertData,
    });

    return data;
  },

  /**
   * Update an existing staff_directory row.
   */
  async updateStaff(id, fields, changedBy) {
    // Duplicate check (exclude self)
    if (fields?.full_name && fields?.office_location_normalized) {
      const { data: existing } = await supabase
        ?.from('staff_directory')
        ?.select('id')
        ?.eq('full_name', fields?.full_name?.trim())
        ?.eq('office_location_normalized', fields?.office_location_normalized?.trim())
        ?.neq('id', id)
        ?.limit(1);

      if (existing?.length > 0) {
        throw new Error(`Another staff member named "${fields?.full_name}" already exists at ${fields?.office_location_normalized}.`);
      }
    }

    const updateData = {};
    const allowedFields = [
      'directory_display_name', 'contact_list_employee_name', 'full_name',
      'first_name', 'last_name', 'office_location_normalized', 'job_title',
      'role_category', 'worker_type', 'preferred_email', 'work_email',
      'personal_email', 'phone', 'date_of_birth', 'notes', 'is_active',
      'employee_pronouns',
    ];

    for (const key of allowedFields) {
      if (key in fields) {
        const val = fields?.[key];
        updateData[key] = typeof val === 'string' ? (val?.trim() || null) : val;
      }
    }

    const { data, error } = await supabase
      ?.from('staff_directory')
      ?.update(updateData)
      ?.eq('id', id)
      ?.select()
      ?.single();

    if (error) throw error;

    await staffDirectoryService?.logAudit({
      staffId: id,
      action: 'update',
      changedBy,
      changedFields: updateData,
    });

    return data;
  },

  /**
   * Upload a staff photo to the private bucket.
   * Returns the storage path.
   */
  async uploadPhoto(staffId, file, changedBy) {
    const ext = file?.name?.split('.')?.pop()?.toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowed?.includes(ext)) {
      throw new Error('Only JPEG, PNG, or WebP images are allowed.');
    }
    if (file?.size > 5 * 1024 * 1024) {
      throw new Error('Photo must be under 5 MB.');
    }

    const path = `staff/${staffId}/${Date.now()}.${ext}`;

    // Remove old photo if exists
    const { data: current } = await supabase
      ?.from('staff_directory')
      ?.select('photo_storage_path')
      ?.eq('id', staffId)
      ?.single();

    if (current?.photo_storage_path) {
      await supabase?.storage?.from(PHOTO_BUCKET)?.remove([current?.photo_storage_path]);
    }

    const { error: uploadError } = await supabase?.storage
      ?.from(PHOTO_BUCKET)
      ?.upload(path, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      ?.from('staff_directory')
      ?.update({ photo_storage_path: path, photo_uploaded_at: new Date()?.toISOString() })
      ?.eq('id', staffId)
      ?.select()
      ?.single();

    if (error) throw error;

    const action = current?.photo_storage_path ? 'photo_replace' : 'photo_upload';
    await staffDirectoryService?.logAudit({
      staffId,
      action,
      changedBy,
      changedFields: { photo_storage_path: path },
    });

    return data;
  },

  /**
   * Remove a staff photo from storage and clear the path.
   */
  async removePhoto(staffId, changedBy) {
    const { data: current } = await supabase
      ?.from('staff_directory')
      ?.select('photo_storage_path')
      ?.eq('id', staffId)
      ?.single();

    if (current?.photo_storage_path) {
      await supabase?.storage?.from(PHOTO_BUCKET)?.remove([current?.photo_storage_path]);
    }

    const { data, error } = await supabase
      ?.from('staff_directory')
      ?.update({ photo_storage_path: null, photo_uploaded_at: null })
      ?.eq('id', staffId)
      ?.select()
      ?.single();

    if (error) throw error;

    await staffDirectoryService?.logAudit({
      staffId,
      action: 'photo_remove',
      changedBy,
      changedFields: { photo_storage_path: null },
    });

    return data;
  },

  /**
   * Get a signed URL for a private photo path.
   */
  async getPhotoSignedUrl(storagePath) {
    if (!storagePath) return null;
    const { data, error } = await supabase?.storage
      ?.from(PHOTO_BUCKET)
      ?.createSignedUrl(storagePath, SIGNED_URL_EXPIRY);
    if (error) return null;
    return data?.signedUrl || null;
  },

  /**
   * V735B: Upload a photo to staff-directory-photos scoped to the staff_directory row,
   * then call the update_own_staff_directory_photo RPC to update photo_storage_path
   * and photo_uploaded_at. Only works for the authenticated user's own matched row.
   * Returns { storagePath, signedUrl }.
   */
  async uploadOwnPhoto(staffDirectoryId, file) {
    const ext = file?.name?.split('.')?.pop()?.toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'webp'];
    if (!allowed?.includes(ext)) {
      throw new Error('Only JPEG, PNG, or WebP images are allowed.');
    }
    if (file?.size > 5 * 1024 * 1024) {
      throw new Error('Photo must be under 5 MB.');
    }

    // Path scoped to staff_directory.id: {staffDirectoryId}/{timestamp}.ext
    const path = `${staffDirectoryId}/${Date.now()}.${ext}`;

    // Upload to staff-directory-photos bucket
    const { error: uploadError } = await supabase?.storage
      ?.from(PHOTO_BUCKET)
      ?.upload(path, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    // Call the narrow SECURITY DEFINER RPC to update only photo fields
    const { data: rpcData, error: rpcError } = await supabase?.rpc(
      'update_own_staff_directory_photo',
      {
        p_staff_directory_id: staffDirectoryId,
        p_photo_storage_path: path,
        p_photo_uploaded_at:  new Date()?.toISOString(),
      }
    );

    if (rpcError) {
      // Clean up the uploaded file if the DB update fails
      await supabase?.storage?.from(PHOTO_BUCKET)?.remove([path])?.catch(() => {});
      throw rpcError;
    }

    // Get a fresh signed URL for immediate display
    const signedUrl = await staffDirectoryService?.getPhotoSignedUrl(path);

    return { storagePath: path, signedUrl, rpcResult: rpcData };
  },

  /**
   * Write an entry to staff_directory_audit_logs.
   */
  async logAudit({ staffId, action, changedBy, changedFields, notes }) {
    try {
      await supabase?.from('staff_directory_audit_logs')?.insert({
        staff_id: staffId,
        action,
        changed_by: changedBy || null,
        changed_fields: changedFields || null,
        notes: notes || null,
      });
    } catch {
      // Audit failure should not break the main operation
    }
  },
};
