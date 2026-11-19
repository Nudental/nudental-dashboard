import { supabase } from '../lib/supabase';
import { assertInsuranceComplete, completionRules } from './insuranceCompletionValidation';

// ─── Request Queue ─────────────────────────────────────────────────────────────

/**
 * Fetch insurance verification requests with optional filters.
 * Returns rows ordered by requested_at desc.
 */
export const fetchVerificationRequests = async (filters = {}) => {
  let query = supabase
    ?.from('insurance_work_requests')
    ?.select('*')
    ?.order('requested_at', { ascending: false });

  if (filters?.status && filters?.status !== 'all') {
    query = query?.eq('status', filters?.status);
  }
  if (filters?.officeId) {
    query = query?.eq('office_id', filters?.officeId);
  }
  if (filters?.assignedToMe && filters?.userId) {
    query = query?.eq('assigned_to_user_id', filters?.userId);
  }
  if (filters?.dateFrom) {
    query = query?.gte('requested_at', filters?.dateFrom);
  }
  if (filters?.dateTo) {
    const to = new Date(filters.dateTo);
    to?.setDate(to?.getDate() + 1);
    query = query?.lt('requested_at', to?.toISOString());
  }
  if (filters?.search?.trim()) {
    const s = filters?.search?.trim()?.replace(/\\/g, '\\\\')?.replace(/"/g, '\\"');
    query = query?.or(
      `patient_first_name.ilike."%${s}%",patient_last_name.ilike."%${s}%",patient_name.ilike."%${s}%",insurance_company_name.ilike."%${s}%",member_id.ilike."%${s}%",ascend_chart_number.ilike."%${s}%"`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ─── Audit Log ─────────────────────────────────────────────────────────────────

/**
 * Fetch audit log entries for a specific request.
 */
export const fetchAuditLog = async (requestId) => {
  const { data, error } = await supabase
    ?.from('insurance_verification_audit_log')
    ?.select('*')
    ?.eq('request_id', requestId)
    ?.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

/**
 * Insert an audit log entry.
 * Silently fails if RLS blocks it — caller should handle gracefully.
 */
export const insertAuditLog = async ({
  requestId,
  verificationId = null,
  eventType,
  performedByUserId,
  performedByEmail,
  performedByName,
  oldStatus = null,
  newStatus = null,
  metadata = {},
}) => {
  const { error } = await supabase?.from('insurance_verification_audit_log')?.insert({
    request_id: requestId,
    verification_id: verificationId,
    event_type: eventType,
    performed_by_user_id: performedByUserId,
    performed_by_email: performedByEmail,
    performed_by_name: performedByName,
    old_status: oldStatus,
    new_status: newStatus,
    metadata,
  });
  if (error) {
    // Non-fatal — log but don't throw; RLS may restrict audit inserts for some roles
    console.warn('[insuranceVerifyService] Audit log insert blocked or failed:', error?.message);
  }
};

// ─── Create Request ────────────────────────────────────────────────────────────

/**
 * Create a new insurance verification request.
 * Sets status = 'requested'.
 * The database timestamps intake and queues the office notice.
 */
export const createVerificationRequest = async (formData, userProfile) => {
  // submission_date is a legacy NOT NULL date column — use today's local date in YYYY-MM-DD format
  const todayDate = new Date()?.toLocaleDateString('en-CA'); // 'en-CA' locale produces YYYY-MM-DD

  const row = {
    // Legacy required column — must be present or DB throws NOT NULL constraint error
    submission_date: todayDate,
    // Patient
    patient_first_name: formData?.patientFirstName || '',
    patient_last_name: formData?.patientLastName || '',
    patient_name: `${formData?.patientFirstName || ''} ${formData?.patientLastName || ''}`?.trim(),
    patient_dob: formData?.patientDob || null,
    ascend_chart_number: formData?.ascendChartNumber?.trim()?.toUpperCase() || null,
    patient_phone: formData?.patientPhone || '',
    // Appointment
    appointment_date: formData?.appointmentDate || null,
    appointment_time: formData?.appointmentTime || null,
    // Insurance
    insurance_company_name: formData?.insuranceCompanyName || '',
    insurance_phone: formData?.insurancePhone || '',
    member_id: formData?.memberId || '',
    group_number: formData?.groupNumber || '',
    // Office
    office_id: formData?.officeId || null,
    office_name: formData?.officeName || '',
    office_email: formData?.officeEmail || '',
    // Staff / Requester
    requesting_staff_name: formData?.requestingStaffName || userProfile?.full_name || '',
    requesting_staff_role: formData?.requestingStaffRole || userProfile?.role || '',
    requested_by_user_id: userProfile?.id || null,
    requested_by_name: userProfile?.full_name || formData?.requestingStaffName || '',
    // Notes
    additional_notes: formData?.additionalNotes || null,
    // Workflow
    status: 'requested',

    // Delivery tracking is updated by the corresponding action.
    request_email_sent_at: null,
    pdf_generated_at: null,
    chart_uploaded_at: null,
    office_emailed_at: null,
  };

  const { data, error } = await supabase
    ?.from('insurance_verification_requests')
    ?.insert(row)
    ?.select('id,status')
    ?.single();

  if (error) throw error;
  return data;
};

// ─── Cancel Request ────────────────────────────────────────────────────────────

/**
 * Cancel a verification request.
 * Sets status = 'cancelled', cancelled_at, cancel_reason.
 * Does NOT send emails.
 */
export const cancelVerificationRequest = async (requestId, cancelReason, userProfile) => {
  const { data: current, error: readError } = await supabase
    ?.from('insurance_verification_requests')
    ?.select('status')
    ?.eq('id', requestId)
    ?.single();
  if (readError) throw readError;
  if (!current || ['cancelled', 'completed', 'uploaded_to_chart'].includes(current.status)) {
    throw new Error('This request cannot be cancelled in its current state.');
  }
  const now = new Date()?.toISOString();

  const { data, error } = await supabase
    ?.from('insurance_verification_requests')
    ?.update({
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: cancelReason || null,
      updated_at: now,
    })
    ?.eq('id', requestId)
    ?.eq('status', current.status)
    ?.select('id,status')
    ?.maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('This request changed. Refresh it before trying again.');

  // Attempt audit log — non-fatal if RLS blocks
  await insertAuditLog({
    requestId,
    eventType: 'status_changed',
    performedByUserId: userProfile?.id,
    performedByEmail: userProfile?.email,
    performedByName: userProfile?.full_name,
    oldStatus: current.status,
    newStatus: 'cancelled',
    metadata: { cancel_reason: cancelReason },
  });

  return data;
};

// ─── Offices ───────────────────────────────────────────────────────────────────

/**
 * Fetch active offices for the office dropdown.
 */
export const fetchOffices = async () => {
  const { data, error } = await supabase.rpc('insurance_workflow_offices');
  if (error) throw error;
  return data || [];
};

/**
 * Fetch a verification record by request_id.
 * Returns null if none exists.
 */
export const fetchVerificationByRequestId = async (requestId) => {
  if (!requestId) return null;
  const { data, error } = await supabase
    ?.from('insurance_work_breakdowns')
    ?.select('*')
    ?.eq('request_id', requestId)
    ?.limit(1)
    ?.maybeSingle();
  if (error) throw error;
  return data || null;
};

/**
 * Create a new verification record (status = draft).
 * Links to the request via request_id.
 * Also updates insurance_verification_requests.started_at and status = in_progress.
 */
export const createVerification = async (requestId, formData, userProfile) => {
  const now = new Date()?.toISOString();

  const row = buildVerificationRow(formData, requestId, userProfile, now);

  const { data, error } = await supabase
    ?.from('insurance_verifications')
    ?.insert(row)
    ?.select('id,status')
    ?.single();

  if (error) throw error;

  // Audit log — non-fatal
  await insertAuditLog({
    requestId,
    verificationId: data?.id,
    eventType: 'verification_started',
    performedByUserId: userProfile?.id,
    performedByEmail: userProfile?.email,
    performedByName: userProfile?.full_name,
    oldStatus: null,
    newStatus: 'in_progress',
    metadata: {},
  });

  return data;
};

/**
 * Update an existing verification record (save draft).
 * Guard: throws if the verification is already completed — completed records are locked.
 */
export const updateVerification = async (verificationId, requestId, formData, userProfile) => {
  const now = new Date()?.toISOString();

  // Service-level guard: fetch current status before writing
  const { data: current, error: fetchErr } = await supabase
    ?.from('insurance_verifications')
    ?.select('status')
    ?.eq('id', verificationId)
    ?.single();
  if (fetchErr) throw fetchErr;
  if (current?.status === 'completed') {
    throw new Error('This verification is completed and locked. No changes can be saved.');
  }

  const row = buildVerificationRow(formData, requestId, userProfile, now);
  // Don't overwrite status on save draft — keep existing
  delete row?.status;

  const { data, error } = await supabase
    ?.from('insurance_verifications')
    ?.update({ ...row, updated_at: now })
    ?.eq('id', verificationId)
    ?.select('id,status')
    ?.single();

  if (error) throw error;

  // Audit log — non-fatal
  await insertAuditLog({
    requestId,
    verificationId,
    eventType: 'form_saved',
    performedByUserId: userProfile?.id,
    performedByEmail: userProfile?.email,
    performedByName: userProfile?.full_name,
    metadata: {},
  });

  return data;
};

/**
 * Mark a verification as completed.
 * Guard: throws if the verification is already completed — prevents double-completion.
 * Sets status = completed, completed_at, completed_by_*.
 * Updates the linked request: status = completed, completed_at, completed_by_*.
 */
export const completeVerification = async (verificationId, requestId, formData, userProfile) => {
  assertInsuranceComplete(formData);
  const now = new Date()?.toISOString();

  // Service-level guard: fetch current status before writing
  const { data: current, error: fetchErr } = await supabase
    ?.from('insurance_verifications')
    ?.select('status')
    ?.eq('id', verificationId)
    ?.single();
  if (fetchErr) throw fetchErr;
  if (current?.status === 'completed') {
    throw new Error('This verification is already completed and cannot be modified.');
  }

  const row = buildVerificationRow(formData, requestId, userProfile, now);
  row.status = 'completed';
  const { data, error } = await supabase
    ?.from('insurance_verifications')
    ?.update({ ...row, updated_at: now })
    ?.eq('id', verificationId)
    ?.select('id,status')
    ?.single();

  if (error) throw error;

  // Audit log — non-fatal
  await insertAuditLog({
    requestId,
    verificationId,
    eventType: 'form_completed',
    performedByUserId: userProfile?.id,
    performedByEmail: userProfile?.email,
    performedByName: userProfile?.full_name,
    oldStatus: 'in_progress',
    newStatus: 'completed',
    metadata: {},
  });

  return data;
};

// ─── Internal: Build Verification Row ─────────────────────────────────────────

function buildVerificationRow(formData, requestId, userProfile, now) {
  const f = formData || {};
  return {
    request_id: requestId,
    status: 'draft',
    // A. Patient Information
    date: f?.date || null,
    patient_name: f?.patient_name || null,
    patient_dob: f?.patient_dob || null,
    subscriber_name: f?.subscriber_name || null,
    subscriber_dob: f?.subscriber_dob || null,
    // B. Insurance Information
    insurance_name: f?.insurance_name || null,
    insurance_phone: f?.insurance_phone || null,
    claims_address: f?.claims_address || null,
    member_id: f?.member_id || null,
    group_number: f?.group_number || null,
    employer_group_name: f?.employer_group_name || null,
    payor_id: f?.payor_id || null,
    fee_schedule: f?.fee_schedule || null,
    network: f?.network || null,
    oon_available: f?.oon_available ?? null,
    year_type: f?.year_type || null,
    eff_date: f?.eff_date || null,
    term_date: f?.term_date || null,
    // C. Benefits Summary
    yearly_max: f?.yearly_max != null && f?.yearly_max !== '' ? Number(f?.yearly_max) : null,
    remaining_max: f?.remaining_max != null && f?.remaining_max !== '' ? Number(f?.remaining_max) : null,
    max_applies: f?.max_applies || null,
    deductible: f?.deductible != null && f?.deductible !== '' ? Number(f?.deductible) : null,
    deductible_met: f?.deductible_met ?? null,
    ded_applies: f?.ded_applies || null,
    pct_prev: f?.pct_prev != null && f?.pct_prev !== '' ? Number(f?.pct_prev) : null,
    pct_basic: f?.pct_basic != null && f?.pct_basic !== '' ? Number(f?.pct_basic) : null,
    pct_endo: f?.pct_endo != null && f?.pct_endo !== '' ? Number(f?.pct_endo) : null,
    pct_os: f?.pct_os != null && f?.pct_os !== '' ? Number(f?.pct_os) : null,
    pct_perio: f?.pct_perio != null && f?.pct_perio !== '' ? Number(f?.pct_perio) : null,
    pct_major: f?.pct_major != null && f?.pct_major !== '' ? Number(f?.pct_major) : null,
    pct_crowns: f?.pct_crowns != null && f?.pct_crowns !== '' ? Number(f?.pct_crowns) : null,
    pct_bridges: f?.pct_bridges != null && f?.pct_bridges !== '' ? Number(f?.pct_bridges) : null,
    pct_dentures: f?.pct_dentures != null && f?.pct_dentures !== '' ? Number(f?.pct_dentures) : null,
    waiting_period: f?.waiting_period ?? null,
    missing_tooth_clause: f?.missing_tooth_clause ?? null,
    dep_age_limit: f?.dep_age_limit != null && f?.dep_age_limit !== '' ? Number(f?.dep_age_limit) : null,
    student_age_limit: f?.student_age_limit != null && f?.student_age_limit !== '' ? Number(f?.student_age_limit) : null,
    ucr_allowed: f?.ucr_allowed ?? null,
    self_funded: f?.self_funded ?? null,
    family_deductible: f?.family_deductible != null && f?.family_deductible !== '' ? Number(f?.family_deductible) : null,
    family_deductible_met: f?.family_deductible_met ?? null,
    individual_deductible_remaining: f?.individual_deductible_remaining != null && f?.individual_deductible_remaining !== '' ? Number(f?.individual_deductible_remaining) : null,
    // D-J: JSONB sections
    prev_diag: f?.prev_diag || null,
    endodontics: f?.endodontics || null,
    restorative: f?.restorative || null,
    periodontics: f?.periodontics || null,
    oral_surgery: f?.oral_surgery || null,
    implants: f?.implants || null,
    ortho: f?.ortho || null,
    misc: f?.misc || null,
    history: f?.history || null,
    // J. Misc top-level
    rep_name: f?.rep_name || null,
    ref_number: f?.ref_number || null,
    employee_initials: f?.employee_initials || null,
    notes: f?.notes || null,
    office: f?.office || null,
    form_data: { ...(f.form_data || {}), not_applicable: Object.fromEntries(
      completionRules.filter(rule => {
        const value = rule.path.split('.').reduce((object, key) => object?.[key], f);
        return value == null || String(value).trim() === '';
      }).filter(rule => typeof f.form_data?.not_applicable?.[rule.path] === 'string')
        .map(rule => [rule.path, f.form_data.not_applicable[rule.path].trim()])
    ) },
    // Timestamps
    updated_at: now,
  };
}
