import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  fetchVerificationByRequestId,
  createVerification,
  updateVerification,
  completeVerification,
} from '../../../services/insuranceVerifyService';
import {
  generateAndDownloadInsurancePDF,
  emailInsurancePDFToOffice,
} from '../../../services/insuranceVerificationPDFService';
import {
  lookupDentrixPatientForVerification,
  runDentrixRealUpload,
  getDentrixUploadStatus,
} from '../../../services/dentrixUploadService';
import { useRbacGuard } from '../../../hooks/useRbacGuard';
import EmailPDFToOfficeModal from './EmailPDFToOfficeModal';
import DentrixPatientLookupModal from './DentrixPatientLookupModal';
import DentrixUploadConfirmModal from './DentrixUploadConfirmModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = () => format(new Date(), 'yyyy-MM-dd');

const EMPTY_FORM = {
  // A. Patient Info
  date: today(),
  patient_name: '',
  patient_dob: '',
  subscriber_name: '',
  subscriber_dob: '',
  // B. Insurance Info
  insurance_name: '',
  insurance_phone: '',
  claims_address: '',
  member_id: '',
  group_number: '',
  employer_group_name: '',
  payor_id: '',
  fee_schedule: '',
  network: '',
  oon_available: null,
  year_type: '',
  eff_date: '',
  term_date: '',
  // C. Benefits Summary
  yearly_max: '',
  remaining_max: '',
  max_applies: { preventive: false, basic: false, major: false },
  deductible: '',
  deductible_met: null,
  ded_applies: { preventive: false, basic: false, major: false },
  pct_prev: '',
  pct_basic: '',
  pct_endo: '',
  pct_os: '',
  pct_perio: '',
  pct_major: '',
  pct_crowns: '',
  pct_bridges: '',
  pct_dentures: '',
  waiting_period: null,
  missing_tooth_clause: null,
  dep_age_limit: '',
  student_age_limit: '',
  ucr_allowed: null,
  self_funded: null,
  family_deductible: '',
  family_deductible_met: null,
  individual_deductible_remaining: '',
  // D. Prev/Diag
  prev_diag: {
    comp_exam_d0150: '', periodic_exam_d0120: '', limited_exam_d0140: '',
    shared_freq: null, tx_with_limited: null,
    prophy: '', bw_d0272_d0274: '', pa_d0220: '', fmx_pano: '',
    fmx_pano_shared: null, eligible_fmx_pano: null,
    ct_scan: '', intraoral_d0350: '',
    sealant_d1351: '', sealant_age_limit: '', sealant_covered_teeth: '',
    fluoride: '', fluoride_age_limit: '',
  },
  // E. Restorative
  restorative: {
    post_comp_pct: '', post_comp_freq: '', post_comp_downgraded: null, post_comp_downgrade_codes: '',
    porc_crown_pct: '', porc_crown_freq: '', porc_crown_downgrade: null, porc_crown_downgrade_code: '',
    onlay_pct: '', onlay_freq: '', onlay_downgrade: null, onlay_downgrade_code: '',
    crowns_paid_on: '',
    bridges_dentures_pct: '', bridges_dentures_freq: '',
  },
  // F. Periodontics
  periodontics: {
    srp_pct: '', srp_freq: '', srp_quads: '',
    perio_maint_pct: '', perio_maint_freq: '', perio_maint_shared_prophy: null,
    healing_period_srp_pmr: '',
    debridement_pct: '', debridement_freq: '',
    crown_lengthening_pct: '', crown_lengthening_freq: '',
    osseous_pct: '', osseous_freq: '',
    tissue_graft_pct: '', tissue_graft_freq: '',
    arestin_pct: '', arestin_freq: '',
  },
  // G. Oral Surgery
  oral_surgery: {
    os_to_medical_primary: null,
    d7210_pct: '', d7220_pct: '', d7230_pct: '', d7240_pct: '', d7241_pct: '',
    d7250_pct: '', d7251_pct: '',
    bone_graft_pct: '', bone_graft_freq: '',
    bone_graft_implant_pct: '', bone_graft_implant_freq: '',
    gtr_pct: '', gtr_freq: '',
    gtr_implant_pct: '', gtr_implant_freq: '',
    incision_drainage_pct: '', incision_drainage_freq: '',
  },
  // H. Implants
  implants: {
    implant_body_pct: '', implant_abutment_pct: '', implant_crown_pct: '',
    implant_freq: '', implant_downgrade: '',
    porc_pontic_pct: '', abutment_retainer_pct: '', abutment_downgrade: '',
  },
  // I. Ortho
  ortho: {
    ortho_pct: '', ortho_max: '', ortho_age_limit: '', ortho_deductible: null,
  },
  // J. Misc
  misc: {
    consult_pct: '', consult_freq: '',
    nitrous_pct: '', nitrous_freq: '',
    nightguard_pct: '', nightguard_freq: '',
    bruxism_or_osseous: '',
  },
  history: { has_history: null, history_notes: '' },
  rep_name: '',
  ref_number: '',
  employee_initials: '',
  notes: '',
  office: '',
};

// ─── UI Primitives ─────────────────────────────────────────────────────────────

const Label = ({ children, required = false }) => (
  <label className="block text-xs font-medium text-text-secondary mb-1">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

const TextInput = ({ label, value, onChange, placeholder = '', required = false, type = 'text', readOnly = false }) => (
  <div>
    {label && <Label required={required}>{label}</Label>}
    <input
      type={type}
      value={value ?? ''}
      onChange={readOnly ? undefined : (e) => onChange(e?.target?.value)}
      readOnly={readOnly}
      placeholder={readOnly ? '' : (placeholder || '')}
      className={`w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${readOnly ? 'opacity-75 cursor-default select-text' : ''}`}
    />
  </div>
);

const NumberInput = ({ label, value, onChange, placeholder = '', readOnly = false }) => (
  <div>
    {label && <Label>{label}</Label>}
    <input
      type="number"
      value={value ?? ''}
      onChange={readOnly ? undefined : (e) => onChange(e?.target?.value)}
      readOnly={readOnly}
      placeholder={readOnly ? '' : (placeholder || '')}
      className={`w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${readOnly ? 'opacity-75 cursor-default' : ''}`}
    />
  </div>
);

const DateInput = ({ label, value, onChange, required = false, readOnly = false }) => (
  <div>
    {label && <Label required={required}>{label}</Label>}
    <input
      type="date"
      value={value ?? ''}
      onChange={readOnly ? undefined : (e) => onChange(e?.target?.value)}
      readOnly={readOnly}
      className={`w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${readOnly ? 'opacity-75 cursor-default' : ''}`}
    />
  </div>
);

const YNSelect = ({ label, value, onChange, readOnly = false }) => (
  <div>
    {label && <Label>{label}</Label>}
    <select
      value={value === null || value === undefined ? '' : String(value)}
      onChange={readOnly ? undefined : (e) => {
        const v = e?.target?.value;
        onChange(v === '' ? null : v === 'true');
      }}
      disabled={readOnly}
      className={`w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${readOnly ? 'opacity-75 cursor-default' : ''}`}
    >
      <option value="">—</option>
      <option value="true">Y</option>
      <option value="false">N</option>
    </select>
  </div>
);

const CheckboxGroup = ({ label, value = {}, keys, onChange, readOnly = false }) => (
  <div>
    {label && <Label>{label}</Label>}
    <div className="flex gap-4 mt-1">
      {keys?.map((k) => (
        <label key={k} className={`flex items-center gap-1.5 text-sm text-text-primary ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            checked={!!value?.[k]}
            onChange={readOnly ? undefined : (e) => onChange({ ...value, [k]: e?.target?.checked })}
            disabled={readOnly}
            className="rounded border-border text-primary"
          />
          {k?.charAt(0)?.toUpperCase() + k?.slice(1)}
        </label>
      ))}
    </div>
  </div>
);

const SectionHeader = ({ title, icon, isOpen, onToggle, badge = null }) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full flex items-center justify-between px-4 py-3 bg-surface-secondary rounded-xl border border-border hover:bg-surface-tertiary transition-colors"
  >
    <div className="flex items-center gap-2">
      <Icon name={icon} size={16} className="text-primary" />
      <span className="text-sm font-semibold text-text-primary">{title}</span>
      {badge && (
        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{badge}</span>
      )}
    </div>
    <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-text-secondary" />
  </button>
);

const Grid2 = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
);
const Grid3 = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>
);

// ─── Completion Confirmation Modal ────────────────────────────────────────────

const CompleteModal = ({ isOpen, onConfirm, onCancel, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-primary rounded-xl shadow-2xl w-full max-w-md border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Icon name="CheckCircle" size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Mark as Completed</h3>
            <p className="text-xs text-text-secondary">This will mark the verification form as completed and update the request status.</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary mb-5">
          Confirm that you have completed the insurance verification breakdown. No PDF will be generated and no email will be sent at this time.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Icon name="Loader2" size={14} className="animate-spin" />}
            Mark Completed
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function InsuranceVerificationForm({ request, onBack, onSaved }) {
  const { userProfile } = useAuth();
  const { success, error: toastError } = useToast();
  const { canAccess, isSuperAdmin } = useRbacGuard();

  const [verification, setVerification] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [pdfResult, setPdfResult] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [openSections, setOpenSections] = useState({
    A: true, B: true, C: true, D: false, E: false, F: false, G: false, H: false, I: false, J: true,
  });

  // Phase 5C-C: Dentrix upload state
  const [showLookupModal, setShowLookupModal] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmedPatient, setConfirmedPatient] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Permission: can email PDF to office
  const canEmailOffice = isSuperAdmin ||
    canAccess('workflow.insurance.email_office') ||
    userProfile?.role === 'admin';

  // Permission: can upload to Dentrix
  const canUploadToDentrix = isSuperAdmin ||
    canAccess('workflow.insurance.upload_to_dentrix') ||
    userProfile?.role === 'admin';

  // Load existing verification if any
  const loadVerification = useCallback(async () => {
    if (!request?.id) return;
    setLoading(true);
    try {
      const v = await fetchVerificationByRequestId(request?.id);
      if (v) {
        setVerification(v);
        setFormData(mapVerificationToForm(v, request));
      } else {
        // Prefill from request
        setFormData(prefillFromRequest(request));
      }
    } catch (err) {
      toastError('Load Error', err?.message || 'Could not load verification data.');
    } finally {
      setLoading(false);
    }
  }, [request?.id]);

  useEffect(() => { loadVerification(); }, [loadVerification]);

  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s?.[key] }));

  const isCompleted = verification?.status === 'completed';
  // When completed, all onChange handlers become no-ops to prevent accidental local state edits
  const isReadOnly = isCompleted;

  const set = (key) => (val) => {
    if (isReadOnly) return;
    setFormData((f) => ({ ...f, [key]: val }));
  };
  const setNested = (section, key) => (val) => {
    if (isReadOnly) return;
    setFormData((f) => ({ ...f, [section]: { ...f?.[section], [key]: val } }));
  };

  const handleSaveDraft = async () => {
    if (isReadOnly) return; // service-level guard: completed forms cannot be saved
    setSaving(true);
    try {
      if (verification?.id) {
        const updated = await updateVerification(verification?.id, request?.id, formData, userProfile);
        setVerification(updated);
        success('Draft Saved', 'Verification form saved as draft.');
      } else {
        const created = await createVerification(request?.id, formData, userProfile);
        setVerification(created);
        success('Draft Saved', 'Verification form created and saved as draft.');
      }
      onSaved?.();
    } catch (err) {
      toastError('Save Failed', err?.message || 'Could not save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (isReadOnly) return; // service-level guard: completed forms cannot be re-completed
    setCompleting(true);
    try {
      if (verification?.id) {
        await completeVerification(verification?.id, request?.id, formData, userProfile);
      } else {
        const created = await createVerification(request?.id, formData, userProfile);
        await completeVerification(created?.id, request?.id, formData, userProfile);
      }
      success('Completed', 'Verification form marked as completed.');
      setShowCompleteModal(false);
      onSaved?.();
      onBack?.();
    } catch (err) {
      toastError('Complete Failed', err?.message || 'Could not complete verification.');
    } finally {
      setCompleting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!isCompleted) {
      toastError('Not Available', 'Complete the verification before generating the final PDF.');
      return;
    }
    setGeneratingPDF(true);
    setPdfResult(null);
    try {
      const result = await generateAndDownloadInsurancePDF(verification, request, userProfile);
      setPdfResult(result);
      if (result?.storageError) {
        success(
          'PDF Downloaded',
          `PDF downloaded to your browser. Storage upload failed: ${result?.storageError}. PDF metadata was not saved.`
        );
      } else if (result?.metadataError) {
        success(
          'PDF Downloaded',
          `PDF downloaded. Stored in Supabase. Metadata update failed: ${result?.metadataError}`
        );
      } else {
        success('PDF Downloaded', 'Insurance verification PDF downloaded and saved to storage.');
      }
      // Reload verification to reflect updated pdf_generated_at
      const updated = await fetchVerificationByRequestId(request?.id);
      if (updated) setVerification(updated);
    } catch (err) {
      toastError('PDF Failed', err?.message || 'Could not generate PDF.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Resolve default recipient: request.office_email → null
  const resolvedOfficeEmail = request?.office_email || null;

  const handleEmailPDFConfirm = async (recipientEmail) => {
    if (!isCompleted) {
      toastError('Not Available', 'Only completed verifications can be emailed.');
      return;
    }
    setSendingEmail(true);
    setEmailResult(null);
    try {
      const result = await emailInsurancePDFToOffice(verification, request, recipientEmail, userProfile);
      setEmailResult({ success: true, recipient: result?.recipient });
      setShowEmailModal(false);
      success(
        'Email Sent',
        `Insurance verification PDF emailed to ${result?.recipient}.`
      );
      // Reload verification to reflect updated office_emailed_at
      const updated = await fetchVerificationByRequestId(request?.id);
      if (updated) setVerification(updated);
    } catch (err) {
      setEmailResult({ success: false, error: err?.message });
      toastError('Email Failed', err?.message || 'Could not send email.');
    } finally {
      setSendingEmail(false);
    }
  };

  // Phase 5C-B: Dentrix upload handlers
  const handleUploadToDentrix = async () => {
    if (!isCompleted) {
      toastError('Not Available', 'Only completed verifications can be uploaded to Dentrix.');
      return;
    }
    // Client-side duplicate safety guard
    const alreadyUploaded =
      !!verification?.dentrix_document_id ||
      request?.chart_upload_status === 'uploaded' ||
      verification?.dentrix_document_upload_status === 'uploaded' ||
      verification?.dentrix_document_upload_status === 'success' ||
      request?.dentrix_document_upload_status === 'uploaded' ||
      request?.dentrix_document_upload_status === 'success';
    if (alreadyUploaded) {
      toastError('Already Uploaded', 'This verification is already uploaded to Dentrix.');
      return;
    }
    setLookupError(null);
    setLookupResult(null);
    setConfirmedPatient(null);
    setUploadResult(null);
    setUploadError(null);
    setShowLookupModal(true);
    setLookupLoading(true);
    try {
      const result = await lookupDentrixPatientForVerification(verification?.id, request?.id);
      setLookupResult(result);
    } catch (err) {
      setLookupError(err?.message || 'Dentrix patient lookup failed.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupConfirm = (patientSnapshot) => {
    setConfirmedPatient(patientSnapshot);
    setShowLookupModal(false);
    setUploadResult(null);
    setUploadError(null);
    setShowConfirmModal(true);
  };

  const handleUploadConfirm = async () => {
    if (!confirmedPatient || !verification) return;
    setUploading(true);
    setUploadResult(null);
    setUploadError(null);
    try {
      const result = await runDentrixRealUpload(verification, request, confirmedPatient);
      setUploadResult(result);
      // On real success: trust backend metadata — do NOT fake client-side.
      if (result?.uploaded) {
        try {
          const updated = await fetchVerificationByRequestId(request?.id);
          if (updated) setVerification(updated);
        } catch { /* non-fatal */ }
      }
    } catch (err) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmModalClose = () => {
    setShowConfirmModal(false);
    setUploadResult(null);
    setUploadError(null);
    setConfirmedPatient(null);
  };

  const isDraft = verification?.status === 'draft';
  const patientName = request?.patient_name ||
    [request?.patient_first_name, request?.patient_last_name]?.filter(Boolean)?.join(' ') || '—';

  // Phase 5C-B: Dentrix upload status
  const dentrixStatus = getDentrixUploadStatus(verification, request);
  // Guard: already uploaded if dentrix_document_id exists, chart_upload_status=uploaded,
  // or dentrix_document_upload_status=success/uploaded
  const isAlreadyUploaded =
    dentrixStatus?.label === 'Uploaded to Dentrix' ||
    !!verification?.dentrix_document_id ||
    request?.chart_upload_status === 'uploaded' ||
    verification?.dentrix_document_upload_status === 'uploaded' ||
    verification?.dentrix_document_upload_status === 'success' ||
    request?.dentrix_document_upload_status === 'uploaded' ||
    request?.dentrix_document_upload_status === 'success';
  const showDentrixUpload = canUploadToDentrix && isCompleted && !isAlreadyUploaded;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="Loader2" size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <Icon name="ArrowLeft" size={16} />
            Back to Queue
          </button>
          <span className="text-text-secondary">/</span>
          <span className="text-sm font-semibold text-text-primary">{patientName}</span>
          {isCompleted && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-800 border-emerald-200">
              Completed
            </span>
          )}
          {isDraft && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-800 border-yellow-200">
              Draft
            </span>
          )}
          {!verification && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-blue-100 text-blue-800 border-blue-200">
              New
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isCompleted && (
            <>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50"
              >
                {saving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Save" size={14} />}
                Save Draft
              </button>
              <button
                onClick={() => setShowCompleteModal(true)}
                disabled={completing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Icon name="CheckCircle" size={14} />
                Mark Completed
              </button>
            </>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <Icon name="CheckCircle" size={14} />
                Completed — read-only
              </div>
              <button
                onClick={handleDownloadPDF}
                disabled={generatingPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {generatingPDF
                  ? <Icon name="Loader2" size={14} className="animate-spin" />
                  : <Icon name="Download" size={14} />
                }
                {generatingPDF ? 'Generating…' : 'Download PDF'}
              </button>
              {canEmailOffice && (
                <button
                  onClick={() => setShowEmailModal(true)}
                  disabled={sendingEmail}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Icon name="Send" size={14} />
                  Email PDF to Office
                </button>
              )}
              {/* Phase 5C-C: Upload PDF to Dentrix button */}
              {showDentrixUpload && (
                <button
                  onClick={handleUploadToDentrix}
                  disabled={lookupLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {lookupLoading
                    ? <Icon name="Loader2" size={14} className="animate-spin" />
                    : <Icon name="Upload" size={14} />
                  }
                  {lookupLoading ? 'Looking up…' : 'Upload PDF to Dentrix'}
                </button>
              )}
              {/* Already uploaded badge */}
              {isAlreadyUploaded && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Icon name="CheckCircle" size={13} />
                  Uploaded to Dentrix
                  {verification?.dentrix_document_id ? ` · ${verification?.dentrix_document_id}` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Read-only banner for completed forms */}
      {isCompleted && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <Icon name="Lock" size={14} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <span>This verification is <strong>completed and locked</strong>. All fields are read-only. No changes can be saved.</span>
            {verification?.pdf_generated_at && (
              <span className="ml-2 text-emerald-600">
                · PDF last generated {format(new Date(verification?.pdf_generated_at), 'MM/dd/yyyy h:mm a')}
              </span>
            )}
            {verification?.office_emailed_at && (
              <span className="ml-2 text-teal-600">
                · Emailed to office {format(new Date(verification?.office_emailed_at), 'MM/dd/yyyy h:mm a')}
                {verification?.office_email_to ? ` → ${verification?.office_email_to}` : ''}
              </span>
            )}
            {isAlreadyUploaded && (
              <span className="ml-2 text-indigo-600">
                · Uploaded to Dentrix
                {verification?.dentrix_document_id ? ` (Doc ID: ${verification?.dentrix_document_id})` : ''}
              </span>
            )}
            {!isAlreadyUploaded && isCompleted && (
              <span className={`ml-2 ${dentrixStatus?.color}`}>
                · Dentrix: {dentrixStatus?.label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* PDF result feedback */}
      {pdfResult && (
        <div className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${pdfResult?.storageError ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
          <Icon name={pdfResult?.storageError ? 'AlertTriangle' : 'CheckCircle'} size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">{pdfResult?.storageError ? 'PDF downloaded (storage failed)' : 'PDF downloaded and stored'}</p>
            {pdfResult?.storageError && <p className="mt-0.5">Storage error: {pdfResult?.storageError}. The PDF was still downloaded to your browser.</p>}
            {!pdfResult?.storageError && pdfResult?.storageResult?.storagePath && (
              <p className="mt-0.5">Stored at: {pdfResult?.storageResult?.storagePath}</p>
            )}
          </div>
        </div>
      )}

      {/* Email result feedback */}
      {emailResult && (
        <div className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${emailResult?.success ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <Icon name={emailResult?.success ? 'MailCheck' : 'MailX'} size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            {emailResult?.success
              ? <span>PDF emailed to office: <strong>{emailResult?.recipient}</strong>.</span>
              : <span>Email failed: {emailResult?.error}</span>
            }
          </div>
        </div>
      )}

      {/* Phase banner (only for non-completed) */}
      {!isCompleted && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
          <Icon name="Info" size={14} className="mt-0.5 flex-shrink-0" />
          <span>Phase 3A: No PDF generation, no office email, no Dentrix upload. Save Draft or Mark Completed only.</span>
        </div>
      )}

      {/* ── Section A: Patient Information ── */}
      <div className="space-y-2">
        <SectionHeader title="A. Patient Information" icon="User" isOpen={openSections?.A} onToggle={() => toggleSection('A')} />
        {openSections?.A && (
          <div className="p-4 border border-border rounded-xl space-y-3">
            <Grid3>
              <DateInput label="Date" value={formData?.date} onChange={set('date')} readOnly={isReadOnly} />
              <TextInput label="Patient Name" value={formData?.patient_name} onChange={set('patient_name')} required readOnly={isReadOnly} />
              <DateInput label="Patient DOB" value={formData?.patient_dob} onChange={set('patient_dob')} required readOnly={isReadOnly} />
            </Grid3>
            <Grid2>
              <TextInput label="Subscriber Name" value={formData?.subscriber_name} onChange={set('subscriber_name')} readOnly={isReadOnly} />
              <DateInput label="Subscriber DOB" value={formData?.subscriber_dob} onChange={set('subscriber_dob')} readOnly={isReadOnly} />
            </Grid2>
          </div>
        )}
      </div>
      {/* ── Section B: Insurance Information ── */}
      <div className="space-y-2">
        <SectionHeader title="B. Insurance Information" icon="Shield" isOpen={openSections?.B} onToggle={() => toggleSection('B')} />
        {openSections?.B && (
          <div className="p-4 border border-border rounded-xl space-y-3">
            <Grid2>
              <TextInput label="Insurance Name" value={formData?.insurance_name} onChange={set('insurance_name')} required readOnly={isReadOnly} />
              <TextInput label="Insurance Phone" value={formData?.insurance_phone} onChange={set('insurance_phone')} readOnly={isReadOnly} />
            </Grid2>
            <TextInput label="Claims Address" value={formData?.claims_address} onChange={set('claims_address')} readOnly={isReadOnly} />
            <Grid3>
              <TextInput label="Member ID" value={formData?.member_id} onChange={set('member_id')} required readOnly={isReadOnly} />
              <TextInput label="Group Number" value={formData?.group_number} onChange={set('group_number')} readOnly={isReadOnly} />
              <TextInput label="Employer / Group Name" value={formData?.employer_group_name} onChange={set('employer_group_name')} readOnly={isReadOnly} />
            </Grid3>
            <Grid3>
              <TextInput label="Payor ID" value={formData?.payor_id} onChange={set('payor_id')} readOnly={isReadOnly} />
              <TextInput label="Fee Schedule" value={formData?.fee_schedule} onChange={set('fee_schedule')} readOnly={isReadOnly} />
              <div>
                <Label>Network</Label>
                <select
                  value={formData?.network ?? ''}
                  onChange={isReadOnly ? undefined : (e) => set('network')(e?.target?.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${isReadOnly ? 'opacity-75 cursor-default' : ''}`}
                >
                  <option value="">—</option>
                  <option value="In">In</option>
                  <option value="Out">Out</option>
                </select>
              </div>
            </Grid3>
            <Grid3>
              <YNSelect label="OON Available" value={formData?.oon_available} onChange={set('oon_available')} readOnly={isReadOnly} />
              <div>
                <Label>Calendar / Contract Year</Label>
                <select
                  value={formData?.year_type ?? ''}
                  onChange={isReadOnly ? undefined : (e) => set('year_type')(e?.target?.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${isReadOnly ? 'opacity-75 cursor-default' : ''}`}
                >
                  <option value="">—</option>
                  <option value="Calendar">Calendar</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
              <DateInput label="Effective Date" value={formData?.eff_date} onChange={set('eff_date')} readOnly={isReadOnly} />
            </Grid3>
            <Grid2>
              <DateInput label="Term Date" value={formData?.term_date} onChange={set('term_date')} readOnly={isReadOnly} />
            </Grid2>
          </div>
        )}
      </div>
      {/* ── Section C: Benefits Summary ── */}
      <div className="space-y-2">
        <SectionHeader title="C. Benefits Summary" icon="DollarSign" isOpen={openSections?.C} onToggle={() => toggleSection('C')} />
        {openSections?.C && (
          <div className="p-4 border border-border rounded-xl space-y-4">
            <Grid3>
              <NumberInput label="Yearly Max ($)" value={formData?.yearly_max} onChange={set('yearly_max')} placeholder="e.g. 1500" readOnly={isReadOnly} />
              <NumberInput label="Remaining Max ($)" value={formData?.remaining_max} onChange={set('remaining_max')} placeholder="e.g. 800" readOnly={isReadOnly} />
              <CheckboxGroup label="Max Applies to" value={formData?.max_applies} keys={['preventive', 'basic', 'major']} onChange={set('max_applies')} readOnly={isReadOnly} />
            </Grid3>
            <Grid3>
              <NumberInput label="Deductible ($)" value={formData?.deductible} onChange={set('deductible')} readOnly={isReadOnly} />
              <YNSelect label="Deductible Met" value={formData?.deductible_met} onChange={set('deductible_met')} readOnly={isReadOnly} />
              <CheckboxGroup label="Deductible Applies to" value={formData?.ded_applies} keys={['preventive', 'basic', 'major']} onChange={set('ded_applies')} readOnly={isReadOnly} />
            </Grid3>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Coverage Percentages</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumberInput label="Preventive/Diagnostic %" value={formData?.pct_prev} onChange={set('pct_prev')} placeholder="e.g. 100" readOnly={isReadOnly} />
                <NumberInput label="Basic %" value={formData?.pct_basic} onChange={set('pct_basic')} readOnly={isReadOnly} />
                <NumberInput label="Endo %" value={formData?.pct_endo} onChange={set('pct_endo')} readOnly={isReadOnly} />
                <NumberInput label="Oral Surgery %" value={formData?.pct_os} onChange={set('pct_os')} readOnly={isReadOnly} />
                <NumberInput label="Perio %" value={formData?.pct_perio} onChange={set('pct_perio')} readOnly={isReadOnly} />
                <NumberInput label="Major %" value={formData?.pct_major} onChange={set('pct_major')} readOnly={isReadOnly} />
                <NumberInput label="Crowns %" value={formData?.pct_crowns} onChange={set('pct_crowns')} readOnly={isReadOnly} />
                <NumberInput label="Bridges %" value={formData?.pct_bridges} onChange={set('pct_bridges')} readOnly={isReadOnly} />
                <NumberInput label="Dentures %" value={formData?.pct_dentures} onChange={set('pct_dentures')} readOnly={isReadOnly} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <YNSelect label="Waiting Period" value={formData?.waiting_period} onChange={set('waiting_period')} readOnly={isReadOnly} />
              <YNSelect label="Missing Tooth Clause" value={formData?.missing_tooth_clause} onChange={set('missing_tooth_clause')} readOnly={isReadOnly} />
              <NumberInput label="Dependent Age Limit" value={formData?.dep_age_limit} onChange={set('dep_age_limit')} readOnly={isReadOnly} />
              <NumberInput label="Student Age Limit" value={formData?.student_age_limit} onChange={set('student_age_limit')} readOnly={isReadOnly} />
              <YNSelect label="Can charge UCR if not covered" value={formData?.ucr_allowed} onChange={set('ucr_allowed')} readOnly={isReadOnly} />
              <YNSelect label="Is plan self-funded" value={formData?.self_funded} onChange={set('self_funded')} readOnly={isReadOnly} />
              <NumberInput label="Family Deductible ($)" value={formData?.family_deductible} onChange={set('family_deductible')} readOnly={isReadOnly} />
              <YNSelect label="Family Deductible Met" value={formData?.family_deductible_met} onChange={set('family_deductible_met')} readOnly={isReadOnly} />
              <NumberInput label="Individual Deductible Remaining ($)" value={formData?.individual_deductible_remaining} onChange={set('individual_deductible_remaining')} readOnly={isReadOnly} />
            </div>
          </div>
        )}
      </div>
      {/* ── Section D: Preventive / Diagnostic ── */}
      <div className="space-y-2">
        <SectionHeader title="D. Preventive / Diagnostic Coverage" icon="Stethoscope" isOpen={openSections?.D} onToggle={() => toggleSection('D')} />
        {openSections?.D && (
          <div className="p-4 border border-border rounded-xl space-y-3">
            <Grid3>
              <TextInput label="Comp Exam D0150 Frequency" value={formData?.prev_diag?.comp_exam_d0150} onChange={setNested('prev_diag', 'comp_exam_d0150')} readOnly={isReadOnly} />
              <TextInput label="Periodic Exam D0120 Frequency" value={formData?.prev_diag?.periodic_exam_d0120} onChange={setNested('prev_diag', 'periodic_exam_d0120')} readOnly={isReadOnly} />
              <TextInput label="Limited Exam D0140 Frequency" value={formData?.prev_diag?.limited_exam_d0140} onChange={setNested('prev_diag', 'limited_exam_d0140')} readOnly={isReadOnly} />
            </Grid3>
            <Grid3>
              <YNSelect label="Shared Frequency" value={formData?.prev_diag?.shared_freq} onChange={setNested('prev_diag', 'shared_freq')} readOnly={isReadOnly} />
              <YNSelect label="Tx with Limited Exam" value={formData?.prev_diag?.tx_with_limited} onChange={setNested('prev_diag', 'tx_with_limited')} readOnly={isReadOnly} />
              <TextInput label="Prophy D1120/D1110" value={formData?.prev_diag?.prophy} onChange={setNested('prev_diag', 'prophy')} readOnly={isReadOnly} />
            </Grid3>
            <Grid3>
              <TextInput label="BW X-rays D0272/D0274" value={formData?.prev_diag?.bw_d0272_d0274} onChange={setNested('prev_diag', 'bw_d0272_d0274')} readOnly={isReadOnly} />
              <TextInput label="PAs D0220" value={formData?.prev_diag?.pa_d0220} onChange={setNested('prev_diag', 'pa_d0220')} readOnly={isReadOnly} />
              <TextInput label="FMX/PANO D0210/D0330" value={formData?.prev_diag?.fmx_pano} onChange={setNested('prev_diag', 'fmx_pano')} readOnly={isReadOnly} />
            </Grid3>
            <Grid3>
              <YNSelect label="FMX/PANO Shared Frequency" value={formData?.prev_diag?.fmx_pano_shared} onChange={setNested('prev_diag', 'fmx_pano_shared')} readOnly={isReadOnly} />
              <YNSelect label="Eligible for FMX/PANO" value={formData?.prev_diag?.eligible_fmx_pano} onChange={setNested('prev_diag', 'eligible_fmx_pano')} readOnly={isReadOnly} />
              <TextInput label="CT Scan D0383/D0367" value={formData?.prev_diag?.ct_scan} onChange={setNested('prev_diag', 'ct_scan')} readOnly={isReadOnly} />
            </Grid3>
            <Grid3>
              <TextInput label="Intraoral Images D0350" value={formData?.prev_diag?.intraoral_d0350} onChange={setNested('prev_diag', 'intraoral_d0350')} readOnly={isReadOnly} />
              <TextInput label="Sealant D1351" value={formData?.prev_diag?.sealant_d1351} onChange={setNested('prev_diag', 'sealant_d1351')} readOnly={isReadOnly} />
              <TextInput label="Sealant Age Limit" value={formData?.prev_diag?.sealant_age_limit} onChange={setNested('prev_diag', 'sealant_age_limit')} readOnly={isReadOnly} />
            </Grid3>
            <Grid3>
              <TextInput label="Sealant Covered Teeth" value={formData?.prev_diag?.sealant_covered_teeth} onChange={setNested('prev_diag', 'sealant_covered_teeth')} readOnly={isReadOnly} />
              <TextInput label="Fluoride D1206/D1208" value={formData?.prev_diag?.fluoride} onChange={setNested('prev_diag', 'fluoride')} readOnly={isReadOnly} />
              <TextInput label="Fluoride Age Limit" value={formData?.prev_diag?.fluoride_age_limit} onChange={setNested('prev_diag', 'fluoride_age_limit')} readOnly={isReadOnly} />
            </Grid3>
          </div>
        )}
      </div>
      {/* ── Section E: Basic / Major Restorative ── */}
      <div className="space-y-2">
        <SectionHeader title="E. Basic / Major Restorative" icon="Layers" isOpen={openSections?.E} onToggle={() => toggleSection('E')} />
        {openSections?.E && (
          <div className="p-4 border border-border rounded-xl space-y-4">
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Posterior Composites D2391-D2394</p>
              <Grid3>
                <NumberInput label="%" value={formData?.restorative?.post_comp_pct} onChange={setNested('restorative', 'post_comp_pct')} readOnly={isReadOnly} />
                <TextInput label="Frequency" value={formData?.restorative?.post_comp_freq} onChange={setNested('restorative', 'post_comp_freq')} readOnly={isReadOnly} />
                <YNSelect label="Downgraded" value={formData?.restorative?.post_comp_downgraded} onChange={setNested('restorative', 'post_comp_downgraded')} readOnly={isReadOnly} />
              </Grid3>
              <div className="mt-2">
                <TextInput label="Downgrade Codes" value={formData?.restorative?.post_comp_downgrade_codes} onChange={setNested('restorative', 'post_comp_downgrade_codes')} readOnly={isReadOnly} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Porcelain Crown D2740</p>
              <Grid3>
                <NumberInput label="%" value={formData?.restorative?.porc_crown_pct} onChange={setNested('restorative', 'porc_crown_pct')} readOnly={isReadOnly} />
                <TextInput label="Frequency" value={formData?.restorative?.porc_crown_freq} onChange={setNested('restorative', 'porc_crown_freq')} readOnly={isReadOnly} />
                <YNSelect label="Downgrade" value={formData?.restorative?.porc_crown_downgrade} onChange={setNested('restorative', 'porc_crown_downgrade')} readOnly={isReadOnly} />
              </Grid3>
              <div className="mt-2">
                <TextInput label="Downgrade Code" value={formData?.restorative?.porc_crown_downgrade_code} onChange={setNested('restorative', 'porc_crown_downgrade_code')} readOnly={isReadOnly} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Onlay D2643/D2644</p>
              <Grid3>
                <NumberInput label="%" value={formData?.restorative?.onlay_pct} onChange={setNested('restorative', 'onlay_pct')} readOnly={isReadOnly} />
                <TextInput label="Frequency" value={formData?.restorative?.onlay_freq} onChange={setNested('restorative', 'onlay_freq')} readOnly={isReadOnly} />
                <YNSelect label="Downgrade" value={formData?.restorative?.onlay_downgrade} onChange={setNested('restorative', 'onlay_downgrade')} readOnly={isReadOnly} />
              </Grid3>
              <div className="mt-2">
                <TextInput label="Downgrade Code" value={formData?.restorative?.onlay_downgrade_code} onChange={setNested('restorative', 'onlay_downgrade_code')} readOnly={isReadOnly} />
              </div>
            </div>
            <Grid2>
              <div>
                <Label>Crowns/Onlays Paid on</Label>
                <select
                  value={formData?.restorative?.crowns_paid_on ?? ''}
                  onChange={isReadOnly ? undefined : (e) => setNested('restorative', 'crowns_paid_on')(e?.target?.value)}
                  disabled={isReadOnly}
                  className={`w-full px-3 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${isReadOnly ? 'opacity-75 cursor-default' : ''}`}
                >
                  <option value="">—</option>
                  <option value="Prep Date">Prep Date</option>
                  <option value="Seat Date">Seat Date</option>
                </select>
              </div>
              <NumberInput label="Bridges/Dentures %" value={formData?.restorative?.bridges_dentures_pct} onChange={setNested('restorative', 'bridges_dentures_pct')} readOnly={isReadOnly} />
            </Grid2>
            <Grid2>
              <TextInput label="Bridges/Dentures Frequency" value={formData?.restorative?.bridges_dentures_freq} onChange={setNested('restorative', 'bridges_dentures_freq')} readOnly={isReadOnly} />
            </Grid2>
          </div>
        )}
      </div>
      {/* ── Section F: Periodontics ── */}
      <div className="space-y-2">
        <SectionHeader title="F. Periodontics" icon="Activity" isOpen={openSections?.F} onToggle={() => toggleSection('F')} />
        {openSections?.F && (
          <div className="p-4 border border-border rounded-xl space-y-4">
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">SRP D4341/D4342</p>
              <Grid3>
                <NumberInput label="%" value={formData?.periodontics?.srp_pct} onChange={setNested('periodontics', 'srp_pct')} readOnly={isReadOnly} />
                <TextInput label="Frequency" value={formData?.periodontics?.srp_freq} onChange={setNested('periodontics', 'srp_freq')} readOnly={isReadOnly} />
                <TextInput label="Quads Allowed" value={formData?.periodontics?.srp_quads} onChange={setNested('periodontics', 'srp_quads')} readOnly={isReadOnly} />
              </Grid3>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-secondary mb-2">Perio Maintenance D4910</p>
              <Grid3>
                <NumberInput label="%" value={formData?.periodontics?.perio_maint_pct} onChange={setNested('periodontics', 'perio_maint_pct')} readOnly={isReadOnly} />
                <TextInput label="Frequency" value={formData?.periodontics?.perio_maint_freq} onChange={setNested('periodontics', 'perio_maint_freq')} readOnly={isReadOnly} />
                <YNSelect label="Shared Freq with Prophy" value={formData?.periodontics?.perio_maint_shared_prophy} onChange={setNested('periodontics', 'perio_maint_shared_prophy')} readOnly={isReadOnly} />
              </Grid3>
              <div className="mt-2">
                <TextInput label="Healing Period between SRP and PMR" value={formData?.periodontics?.healing_period_srp_pmr} onChange={setNested('periodontics', 'healing_period_srp_pmr')} readOnly={isReadOnly} />
              </div>
            </div>
            {[
              { label: 'Debridement D4355', pctKey: 'debridement_pct', freqKey: 'debridement_freq' },
              { label: 'Crown Lengthening D4249', pctKey: 'crown_lengthening_pct', freqKey: 'crown_lengthening_freq' },
              { label: 'Osseous D4260', pctKey: 'osseous_pct', freqKey: 'osseous_freq' },
              { label: 'Tissue Graft D4266', pctKey: 'tissue_graft_pct', freqKey: 'tissue_graft_freq' },
              { label: 'Arestin D4381', pctKey: 'arestin_pct', freqKey: 'arestin_freq' },
            ]?.map(({ label, pctKey, freqKey }) => (
              <div key={pctKey}>
                <p className="text-xs font-semibold text-text-secondary mb-2">{label}</p>
                <Grid2>
                  <NumberInput label="%" value={formData?.periodontics?.[pctKey]} onChange={setNested('periodontics', pctKey)} readOnly={isReadOnly} />
                  <TextInput label="Frequency" value={formData?.periodontics?.[freqKey]} onChange={setNested('periodontics', freqKey)} readOnly={isReadOnly} />
                </Grid2>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ── Section G: Oral Surgery ── */}
      <div className="space-y-2">
        <SectionHeader title="G. Oral Surgery" icon="Scissors" isOpen={openSections?.G} onToggle={() => toggleSection('G')} />
        {openSections?.G && (
          <div className="p-4 border border-border rounded-xl space-y-3">
            <YNSelect label="Does OS go to medical as primary" value={formData?.oral_surgery?.os_to_medical_primary} onChange={setNested('oral_surgery', 'os_to_medical_primary')} readOnly={isReadOnly} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['d7210_pct', 'd7220_pct', 'd7230_pct', 'd7240_pct', 'd7241_pct', 'd7250_pct', 'd7251_pct']?.map((k) => (
                <NumberInput key={k} label={k?.replace('_pct', '')?.toUpperCase() + ' %'} value={formData?.oral_surgery?.[k]} onChange={setNested('oral_surgery', k)} readOnly={isReadOnly} />
              ))}
            </div>
            {[
              { label: 'Bone Graft D7953', pctKey: 'bone_graft_pct', freqKey: 'bone_graft_freq' },
              { label: 'Bone Graft with Implant D6104', pctKey: 'bone_graft_implant_pct', freqKey: 'bone_graft_implant_freq' },
              { label: 'Guided Tissue Regeneration D7956', pctKey: 'gtr_pct', freqKey: 'gtr_freq' },
              { label: 'GTR with Implant D6106', pctKey: 'gtr_implant_pct', freqKey: 'gtr_implant_freq' },
              { label: 'Incision/Drainage Abscess D7510', pctKey: 'incision_drainage_pct', freqKey: 'incision_drainage_freq' },
            ]?.map(({ label, pctKey, freqKey }) => (
              <div key={pctKey}>
                <p className="text-xs font-semibold text-text-secondary mb-2">{label}</p>
                <Grid2>
                  <NumberInput label="%" value={formData?.oral_surgery?.[pctKey]} onChange={setNested('oral_surgery', pctKey)} readOnly={isReadOnly} />
                  <TextInput label="Frequency" value={formData?.oral_surgery?.[freqKey]} onChange={setNested('oral_surgery', freqKey)} readOnly={isReadOnly} />
                </Grid2>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ── Section H: Implants ── */}
      <div className="space-y-2">
        <SectionHeader title="H. Implants" icon="Cpu" isOpen={openSections?.H} onToggle={() => toggleSection('H')} />
        {openSections?.H && (
          <div className="p-4 border border-border rounded-xl space-y-3">
            <Grid3>
              <NumberInput label="Implant Body D6010 %" value={formData?.implants?.implant_body_pct} onChange={setNested('implants', 'implant_body_pct')} readOnly={isReadOnly} />
              <NumberInput label="Implant Abutment D6057 %" value={formData?.implants?.implant_abutment_pct} onChange={setNested('implants', 'implant_abutment_pct')} readOnly={isReadOnly} />
              <NumberInput label="Implant Crown D6058 %" value={formData?.implants?.implant_crown_pct} onChange={setNested('implants', 'implant_crown_pct')} readOnly={isReadOnly} />
            </Grid3>
            <Grid2>
              <TextInput label="Frequency" value={formData?.implants?.implant_freq} onChange={setNested('implants', 'implant_freq')} readOnly={isReadOnly} />
              <TextInput label="Downgrade" value={formData?.implants?.implant_downgrade} onChange={setNested('implants', 'implant_downgrade')} readOnly={isReadOnly} />
            </Grid2>
            <Grid3>
              <NumberInput label="Porcelain/Ceramic Pontic D6245 %" value={formData?.implants?.porc_pontic_pct} onChange={setNested('implants', 'porc_pontic_pct')} readOnly={isReadOnly} />
              <NumberInput label="Abutment Supported Retainer D6068 %" value={formData?.implants?.abutment_retainer_pct} onChange={setNested('implants', 'abutment_retainer_pct')} readOnly={isReadOnly} />
              <TextInput label="Abutment Downgrade" value={formData?.implants?.abutment_downgrade} onChange={setNested('implants', 'abutment_downgrade')} readOnly={isReadOnly} />
            </Grid3>
          </div>
        )}
      </div>
      {/* ── Section I: Ortho ── */}
      <div className="space-y-2">
        <SectionHeader title="I. Ortho" icon="GitBranch" isOpen={openSections?.I} onToggle={() => toggleSection('I')} />
        {openSections?.I && (
          <div className="p-4 border border-border rounded-xl">
            <Grid3>
              <NumberInput label="Ortho D8090 %" value={formData?.ortho?.ortho_pct} onChange={setNested('ortho', 'ortho_pct')} readOnly={isReadOnly} />
              <NumberInput label="Max ($)" value={formData?.ortho?.ortho_max} onChange={setNested('ortho', 'ortho_max')} readOnly={isReadOnly} />
              <TextInput label="Age Limit" value={formData?.ortho?.ortho_age_limit} onChange={setNested('ortho', 'ortho_age_limit')} readOnly={isReadOnly} />
            </Grid3>
            <div className="mt-3">
              <YNSelect label="Deductible" value={formData?.ortho?.ortho_deductible} onChange={setNested('ortho', 'ortho_deductible')} readOnly={isReadOnly} />
            </div>
          </div>
        )}
      </div>
      {/* ── Section J: Misc ── */}
      <div className="space-y-2">
        <SectionHeader title="J. Misc" icon="MoreHorizontal" isOpen={openSections?.J} onToggle={() => toggleSection('J')} />
        {openSections?.J && (
          <div className="p-4 border border-border rounded-xl space-y-4">
            {[
              { label: 'Consult D9310', pctKey: 'consult_pct', freqKey: 'consult_freq' },
              { label: 'Nitrous D9230', pctKey: 'nitrous_pct', freqKey: 'nitrous_freq' },
              { label: 'Nightguard D9944', pctKey: 'nightguard_pct', freqKey: 'nightguard_freq' },
            ]?.map(({ label, pctKey, freqKey }) => (
              <div key={pctKey}>
                <p className="text-xs font-semibold text-text-secondary mb-2">{label}</p>
                <Grid2>
                  <NumberInput label="%" value={formData?.misc?.[pctKey]} onChange={setNested('misc', pctKey)} readOnly={isReadOnly} />
                  <TextInput label="Frequency" value={formData?.misc?.[freqKey]} onChange={setNested('misc', freqKey)} readOnly={isReadOnly} />
                </Grid2>
              </div>
            ))}
            <Grid2>
              <TextInput label="Bruxism or Osseous" value={formData?.misc?.bruxism_or_osseous} onChange={setNested('misc', 'bruxism_or_osseous')} readOnly={isReadOnly} />
            </Grid2>
            <Grid2>
              <YNSelect label="History" value={formData?.history?.has_history} onChange={setNested('history', 'has_history')} readOnly={isReadOnly} />
              <TextInput label="History Notes" value={formData?.history?.history_notes} onChange={setNested('history', 'history_notes')} readOnly={isReadOnly} />
            </Grid2>
            <Grid3>
              <TextInput label="Rep" value={formData?.rep_name} onChange={set('rep_name')} readOnly={isReadOnly} />
              <TextInput label="Ref #" value={formData?.ref_number} onChange={set('ref_number')} readOnly={isReadOnly} />
              <TextInput label="Employee Initials" value={formData?.employee_initials} onChange={set('employee_initials')} required readOnly={isReadOnly} />
            </Grid3>
            <div>
              <Label>Notes</Label>
              <textarea
                value={formData?.notes ?? ''}
                onChange={isReadOnly ? undefined : (e) => set('notes')(e?.target?.value)}
                readOnly={isReadOnly}
                rows={3}
                className={`w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none ${isReadOnly ? 'opacity-75 cursor-default' : ''}`}
                placeholder={isReadOnly ? '' : 'Additional notes…'}
              />
            </div>
          </div>
        )}
      </div>
      {/* Bottom action bar — hidden for completed forms */}
      {!isCompleted && (
        <div className="flex items-center justify-end gap-3 pt-2 pb-6">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            {saving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Save" size={14} />}
            Save Draft
          </button>
          <button
            onClick={() => setShowCompleteModal(true)}
            disabled={completing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Icon name="CheckCircle" size={14} />
            Mark Completed
          </button>
        </div>
      )}

      {/* Bottom PDF download bar for completed forms */}
      {isCompleted && (
        <div className="flex items-center justify-between gap-3 pt-2 pb-6 border-t border-border mt-4">
          <div className="text-xs text-text-secondary">
            {verification?.pdf_generated_at
              ? `PDF last generated: ${format(new Date(verification?.pdf_generated_at), 'MM/dd/yyyy h:mm a')}`
              : 'No PDF generated yet for this verification.'}
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {generatingPDF
              ? <Icon name="Loader2" size={14} className="animate-spin" />
              : <Icon name="Download" size={14} />
            }
            {generatingPDF ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      )}

      {/* Spacer for completed forms so content doesn't crowd the bottom */}
      {isCompleted && <div className="pb-6" />}

      <EmailPDFToOfficeModal
        isOpen={showEmailModal}
        verification={verification}
        request={request}
        defaultRecipient={resolvedOfficeEmail}
        canOverrideRecipient={canEmailOffice}
        sending={sendingEmail}
        onConfirm={handleEmailPDFConfirm}
        onCancel={() => setShowEmailModal(false)}
      />
      <CompleteModal
        isOpen={showCompleteModal}
        onConfirm={handleComplete}
        onCancel={() => setShowCompleteModal(false)}
        loading={completing}
      />
      {/* Phase 5C-B: Dentrix modals */}
      <DentrixPatientLookupModal
        isOpen={showLookupModal}
        loading={lookupLoading}
        lookupError={lookupError}
        lookupResult={lookupResult}
        onConfirm={handleLookupConfirm}
        onCancel={() => { setShowLookupModal(false); setLookupError(null); setLookupResult(null); }}
      />
      <DentrixUploadConfirmModal
        isOpen={showConfirmModal}
        patientSnapshot={confirmedPatient}
        verification={verification}
        request={request}
        running={uploading}
        uploadResult={uploadResult}
        uploadError={uploadError}
        onConfirm={handleUploadConfirm}
        onCancel={() => { setShowConfirmModal(false); setConfirmedPatient(null); }}
        onClose={handleConfirmModalClose}
      />
    </div>
  );
}

// ─── Prefill helpers ──────────────────────────────────────────────────────────

function prefillFromRequest(request) {
  const patientName = request?.patient_name ||
    [request?.patient_first_name, request?.patient_last_name]?.filter(Boolean)?.join(' ') || '';
  return {
    ...EMPTY_FORM,
    date: today(),
    patient_name: patientName,
    patient_dob: request?.patient_dob || '',
    subscriber_name: request?.subscriber_first_name
      ? `${request?.subscriber_first_name} ${request?.subscriber_last_name || ''}`?.trim()
      : '',
    subscriber_dob: request?.subscriber_dob || '',
    insurance_name: request?.insurance_company_name || '',
    insurance_phone: request?.insurance_phone || '',
    member_id: request?.member_id || '',
    group_number: request?.group_number || '',
    eff_date: request?.effective_date || '',
    term_date: request?.termination_date || '',
    office: request?.office_name || '',
  };
}

function mapVerificationToForm(v, request) {
  return {
    date: v?.date || today(),
    patient_name: v?.patient_name || '',
    patient_dob: v?.patient_dob || '',
    subscriber_name: v?.subscriber_name || '',
    subscriber_dob: v?.subscriber_dob || '',
    insurance_name: v?.insurance_name || '',
    insurance_phone: v?.insurance_phone || '',
    claims_address: v?.claims_address || '',
    member_id: v?.member_id || '',
    group_number: v?.group_number || '',
    employer_group_name: v?.employer_group_name || '',
    payor_id: v?.payor_id || '',
    fee_schedule: v?.fee_schedule || '',
    network: v?.network || '',
    oon_available: v?.oon_available ?? null,
    year_type: v?.year_type || '',
    eff_date: v?.eff_date || '',
    term_date: v?.term_date || '',
    yearly_max: v?.yearly_max ?? '',
    remaining_max: v?.remaining_max ?? '',
    max_applies: v?.max_applies || { preventive: false, basic: false, major: false },
    deductible: v?.deductible ?? '',
    deductible_met: v?.deductible_met ?? null,
    ded_applies: v?.ded_applies || { preventive: false, basic: false, major: false },
    pct_prev: v?.pct_prev ?? '',
    pct_basic: v?.pct_basic ?? '',
    pct_endo: v?.pct_endo ?? '',
    pct_os: v?.pct_os ?? '',
    pct_perio: v?.pct_perio ?? '',
    pct_major: v?.pct_major ?? '',
    pct_crowns: v?.pct_crowns ?? '',
    pct_bridges: v?.pct_bridges ?? '',
    pct_dentures: v?.pct_dentures ?? '',
    waiting_period: v?.waiting_period ?? null,
    missing_tooth_clause: v?.missing_tooth_clause ?? null,
    dep_age_limit: v?.dep_age_limit ?? '',
    student_age_limit: v?.student_age_limit ?? '',
    ucr_allowed: v?.ucr_allowed ?? null,
    self_funded: v?.self_funded ?? null,
    family_deductible: v?.family_deductible ?? '',
    family_deductible_met: v?.family_deductible_met ?? null,
    individual_deductible_remaining: v?.individual_deductible_remaining ?? '',
    prev_diag: v?.prev_diag || EMPTY_FORM?.prev_diag,
    endodontics: v?.endodontics || null,
    restorative: v?.restorative || EMPTY_FORM?.restorative,
    periodontics: v?.periodontics || EMPTY_FORM?.periodontics,
    oral_surgery: v?.oral_surgery || EMPTY_FORM?.oral_surgery,
    implants: v?.implants || EMPTY_FORM?.implants,
    ortho: v?.ortho || EMPTY_FORM?.ortho,
    misc: v?.misc || EMPTY_FORM?.misc,
    history: v?.history || EMPTY_FORM?.history,
    rep_name: v?.rep_name || '',
    ref_number: v?.ref_number || '',
    employee_initials: v?.employee_initials || '',
    notes: v?.notes || '',
    office: v?.office || request?.office_name || '',
  };
}
