import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import Icon from '../../../components/AppIcon';
import {
  cancelVerificationRequest,
  fetchAuditLog,
  fetchVerificationByRequestId,
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
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useRbacGuard } from '../../../hooks/useRbacGuard';
import EmailPDFToOfficeModal from './EmailPDFToOfficeModal';
import DentrixPatientLookupModal from './DentrixPatientLookupModal';
import DentrixUploadConfirmModal from './DentrixUploadConfirmModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val) => (val !== null && val !== undefined && val !== '') ? val : '—';
const fmtDate = (val) => {
  if (!val) return '—';
  try { return format(parseISO(val), 'MM/dd/yyyy'); } catch { return val; }
};
const fmtDateTime = (val) => {
  if (!val) return '—';
  try { return format(parseISO(val), 'MM/dd/yyyy h:mm a'); } catch { return val; }
};

const STATUS_LABELS = {
  requested:         'Requested',
  assigned:          'Assigned',
  in_progress:       'In Progress',
  needs_info:        'Needs Info',
  completed:         'Completed',
  emailed_to_office: 'Emailed to Office',
  uploaded_to_chart: 'Uploaded to Chart',
  cancelled:         'Cancelled',
};

const STATUS_COLORS = {
  requested:         'bg-blue-100 text-blue-800 border-blue-200',
  assigned:          'bg-purple-100 text-purple-800 border-purple-200',
  in_progress:       'bg-yellow-100 text-yellow-800 border-yellow-200',
  needs_info:        'bg-orange-100 text-orange-800 border-orange-200',
  completed:         'bg-emerald-100 text-emerald-800 border-emerald-200',
  emailed_to_office: 'bg-teal-100 text-teal-800 border-teal-200',
  uploaded_to_chart: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  cancelled:         'bg-gray-100 text-gray-600 border-gray-200',
};

const VERIF_STATUS_CONFIG = {
  draft:     { label: 'Draft',     color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: 'FileEdit' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'CheckCircle' },
};

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmt(value)}</span>
  </div>
);

const Section = ({ title, icon, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
      <Icon name={icon} size={15} className="text-primary" />
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
    </div>
    <div className="grid grid-cols-2 gap-3">{children}</div>
  </div>
);

// ─── Cancel Confirmation Modal ────────────────────────────────────────────────

const CancelModal = ({ isOpen, onConfirm, onCancel, loading }) => {
  const [reason, setReason] = useState('');
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] w-full max-w-md border border-gray-300 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Icon name="XCircle" size={20} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cancel Request</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
            </div>
          </div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Reason for cancellation (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e?.target?.value)}
            placeholder="Enter reason…"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-3 px-6 pb-6 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Keep Request
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Icon name="Loader2" size={14} className="animate-spin" />}
            Cancel Request
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Request Detail Drawer ────────────────────────────────────────────────────

export default function RequestDetailDrawer({ request, onClose, onRefresh, canCancel, canComplete, onStartVerification }) {
  const { userProfile } = useAuth();
  const { success, error: toastError } = useToast();
  const { canAccess, isSuperAdmin } = useRbacGuard();
  const [auditLog, setAuditLog] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [verification, setVerification] = useState(undefined); // undefined = loading, null = none
  const [verifLoading, setVerifLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [pdfResult, setPdfResult] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  // Phase 5C-B: Dentrix upload state
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

  const loadAuditLog = useCallback(async () => {
    if (!request?.id) return;
    setAuditLoading(true);
    try {
      const data = await fetchAuditLog(request?.id);
      setAuditLog(data);
    } catch (err) {
      console.warn('Could not load audit log:', err?.message);
    } finally {
      setAuditLoading(false);
    }
  }, [request?.id]);

  const loadVerification = useCallback(async () => {
    if (!request?.id) return;
    setVerifLoading(true);
    try {
      const v = await fetchVerificationByRequestId(request?.id);
      setVerification(v);
    } catch (err) {
      console.warn('Could not load verification:', err?.message);
      setVerification(null);
    } finally {
      setVerifLoading(false);
    }
  }, [request?.id]);

  useEffect(() => {
    loadAuditLog();
    loadVerification();
  }, [loadAuditLog, loadVerification]);

  const handleCancel = async (reason) => {
    setCancelling(true);
    try {
      await cancelVerificationRequest(request?.id, reason, userProfile);
      success('Request Cancelled', 'The verification request has been cancelled.');
      setShowCancelModal(false);
      onRefresh?.();
      onClose?.();
    } catch (err) {
      toastError('Cancel Failed', err?.message || 'Could not cancel the request.');
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!verification || verification?.status !== 'completed') {
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
          `PDF downloaded to your browser. Storage upload failed: ${result?.storageError}`
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

  // Resolve default recipient: request.office_email → offices.email → null
  const resolvedOfficeEmail = request?.office_email || null;

  const handleEmailPDFConfirm = async (recipientEmail) => {
    if (!verification || verification?.status !== 'completed') {
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
    if (!verification || verification?.status !== 'completed') {
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
            // On real success: refresh from Supabase — trust backend metadata update.
      // Do NOT fake metadata client-side.
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

  if (!request) return null;

  const patientName = request?.patient_name ||
    [request?.patient_first_name, request?.patient_last_name]?.filter(Boolean)?.join(' ') || '—';
  const statusColor = STATUS_COLORS?.[request?.status] || 'bg-gray-100 text-gray-600 border-gray-200';
  const statusLabel = STATUS_LABELS?.[request?.status] || request?.status || '—';
  const isCancellable = canCancel && !['cancelled', 'completed', 'uploaded_to_chart']?.includes(request?.status);

  // Verification action logic
  const verifStatus = verification?.status; // 'draft' | 'completed' | null/undefined
  const hasVerif = !!verification;
  const verifCfg = verifStatus ? VERIF_STATUS_CONFIG?.[verifStatus] : null;

  const showStartVerif = canComplete && !verifLoading && !hasVerif && !['cancelled']?.includes(request?.status);
  const showContinueVerif = canComplete && !verifLoading && hasVerif && verifStatus === 'draft';
  const showViewVerif = !verifLoading && hasVerif && verifStatus === 'completed';
  const showPDFActions = !verifLoading && hasVerif && verifStatus === 'completed';
  const showEmailAction = canEmailOffice && showPDFActions;

  // Phase 5C-B: Dentrix upload button visibility
  // Show only when: completed, has permission, not already uploaded
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
  const showDentrixUpload = canUploadToDentrix && showPDFActions && !isAlreadyUploaded;

  // Office email status display
  const officeEmailedAt = verification?.office_emailed_at;
  const officeEmailTo = verification?.office_email_to;

  return (
    <>
      {/* Backdrop — darkened solid overlay, no blur */}
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} />
      {/* Drawer — fully opaque, strong shadow and border */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white dark:bg-gray-900 shadow-[0_0_60px_rgba(0,0,0,0.4)] border-l border-gray-300 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="ShieldCheck" size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{patientName}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ── Verification Form Actions ── */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="ClipboardList" size={15} className="text-primary" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Verification Form</span>
              </div>
              {verifLoading && <Icon name="Loader2" size={14} className="animate-spin text-gray-400" />}
              {!verifLoading && verifCfg && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${verifCfg?.color}`}>
                  <Icon name={verifCfg?.icon} size={11} />
                  {verifCfg?.label}
                </span>
              )}
              {!verifLoading && !hasVerif && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-gray-100 text-gray-600 border-gray-200">
                  Not Started
                </span>
              )}
            </div>

            {!verifLoading && verification?.completed_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Completed {fmtDateTime(verification?.completed_at)}
                {verification?.completed_by_name ? ` by ${verification?.completed_by_name}` : ''}
              </p>
            )}

            {/* PDF status indicator */}
            {!verifLoading && hasVerif && verifStatus === 'completed' && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {verification?.pdf_generated_at
                  ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <Icon name="FileCheck" size={11} />
                      PDF generated {fmtDateTime(verification?.pdf_generated_at)}
                    </span>
                  : <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <Icon name="FileX" size={11} />
                      No PDF generated yet
                    </span>
                }
              </div>
            )}

            {/* Office email status indicator */}
            {!verifLoading && hasVerif && verifStatus === 'completed' && (
              <div className="text-xs">
                {officeEmailedAt ? (
                  <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400">
                    <Icon name="MailCheck" size={11} />
                    Emailed to office {fmtDateTime(officeEmailedAt)}
                    {officeEmailTo ? ` → ${officeEmailTo}` : ''}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Icon name="MailX" size={11} />
                    Not emailed to office
                  </span>
                )}
              </div>
            )}

            {/* Dentrix upload status indicator */}
            {!verifLoading && hasVerif && verifStatus === 'completed' && (
              <div className="text-xs">
                <span className={`inline-flex items-center gap-1 ${dentrixStatus?.color}`}>
                  <Icon name={dentrixStatus?.icon} size={11} />
                  Dentrix: {dentrixStatus?.label}
                  {isAlreadyUploaded && verification?.dentrix_document_id
                    ? ` (Doc ID: ${verification?.dentrix_document_id})`
                    : ''}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {showStartVerif && (
                <button
                  onClick={() => { onClose?.(); onStartVerification?.(request, null); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors"
                >
                  <Icon name="PlayCircle" size={15} />
                  Start Verification
                </button>
              )}
              {showContinueVerif && (
                <button
                  onClick={() => { onClose?.(); onStartVerification?.(request, verification); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold transition-colors"
                >
                  <Icon name="PenLine" size={15} />
                  Continue Verification
                </button>
              )}
              {showViewVerif && (
                <button
                  onClick={() => { onClose?.(); onStartVerification?.(request, verification); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <Icon name="Eye" size={15} />
                  View Completed Verification
                </button>
              )}
              {showPDFActions && (
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {generatingPDF
                    ? <Icon name="Loader2" size={15} className="animate-spin" />
                    : <Icon name="Download" size={15} />
                  }
                  {generatingPDF ? 'Generating…' : 'Download PDF'}
                </button>
              )}
              {showEmailAction && (
                <button
                  onClick={() => setShowEmailModal(true)}
                  disabled={sendingEmail}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Icon name="Send" size={15} />
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
                    ? <Icon name="Loader2" size={15} className="animate-spin" />
                    : <Icon name="Upload" size={15} />
                  }
                  {lookupLoading ? 'Looking up…' : 'Upload PDF to Dentrix'}
                </button>
              )}
              {/* Already uploaded badge */}
              {!verifLoading && hasVerif && verifStatus === 'completed' && isAlreadyUploaded && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Icon name="CheckCircle" size={13} />
                  Uploaded to Dentrix
                  {verification?.dentrix_document_id ? ` · ${verification?.dentrix_document_id}` : ''}
                </span>
              )}
            </div>

            {/* PDF result feedback */}
            {pdfResult && (
              <div className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${pdfResult?.storageError ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <Icon name={pdfResult?.storageError ? 'AlertTriangle' : 'CheckCircle'} size={12} className="mt-0.5 flex-shrink-0" />
                <div>
                  {pdfResult?.storageError
                    ? <span>PDF downloaded. Storage failed: {pdfResult?.storageError}</span>
                    : <span>PDF downloaded and stored in Supabase.</span>
                  }
                </div>
              </div>
            )}

            {/* Email result feedback */}
            {emailResult && (
              <div className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${emailResult?.success ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <Icon name={emailResult?.success ? 'MailCheck' : 'MailX'} size={12} className="mt-0.5 flex-shrink-0" />
                <div>
                  {emailResult?.success
                    ? <span>PDF emailed to {emailResult?.recipient}.</span>
                    : <span>Email failed: {emailResult?.error}</span>
                  }
                </div>
              </div>
            )}
          </div>

          {/* Patient Info */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon name="User" size={15} className="text-primary" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Patient Information</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="First Name" value={request?.patient_first_name} />
              <InfoRow label="Last Name" value={request?.patient_last_name} />
              <InfoRow label="Date of Birth" value={fmtDate(request?.patient_dob)} />
              <InfoRow label="Phone" value={request?.patient_phone} />
            </div>
          </div>

          {/* Appointment */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon name="Calendar" size={15} className="text-primary" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Appointment</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Appointment Date" value={fmtDate(request?.appointment_date)} />
              <InfoRow label="Appointment Time" value={fmt(request?.appointment_time)} />
              <InfoRow label="Office" value={request?.office_name} />
              <InfoRow label="Office Email" value={request?.office_email} />
            </div>
          </div>

          {/* Insurance */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon name="FileText" size={15} className="text-primary" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Insurance Information</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Insurance Company" value={request?.insurance_company_name} />
              <InfoRow label="Insurance Phone" value={request?.insurance_phone} />
              <InfoRow label="Member ID" value={request?.member_id} />
              <InfoRow label="Group Number" value={request?.group_number} />
            </div>
          </div>

          {/* Assignment */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon name="UserCheck" size={15} className="text-primary" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Assignment</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Assigned To (Email)" value={request?.assigned_to_email} />
              <InfoRow label="Assigned At" value={fmtDateTime(request?.assigned_at)} />
              <InfoRow label="Requested By" value={request?.requested_by_name} />
              <InfoRow label="Requested At" value={fmtDateTime(request?.requested_at)} />
            </div>
          </div>

          {/* Status & Timestamps */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon name="Clock" size={15} className="text-primary" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Status & Timestamps</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Status" value={statusLabel} />
              <InfoRow label="Started At" value={fmtDateTime(request?.started_at)} />
              <InfoRow label="Completed At" value={fmtDateTime(request?.completed_at)} />
              <InfoRow label="Cancelled At" value={fmtDateTime(request?.cancelled_at)} />
              {request?.cancel_reason && (
                <div className="col-span-2">
                  <InfoRow label="Cancel Reason" value={request?.cancel_reason} />
                </div>
              )}
              <InfoRow label="Last Updated" value={fmtDateTime(request?.updated_at)} />
            </div>
          </div>

          {/* PDF & Chart Upload */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon name="Upload" size={15} className="text-primary" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">PDF & Chart Upload</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="PDF Generated At" value={fmtDateTime(request?.pdf_generated_at)} />
              <InfoRow label="Chart Upload Status" value={fmt(request?.chart_upload_status)} />
              <InfoRow label="Chart Upload Method" value={fmt(request?.chart_upload_method)} />
              <InfoRow label="Chart Uploaded At" value={fmtDateTime(request?.chart_uploaded_at)} />
              <InfoRow label="Dentrix Upload Status" value={dentrixStatus?.label} />
              <InfoRow label="Office Emailed At" value={fmtDateTime(request?.office_emailed_at)} />
            </div>
          </div>

          {/* Notes */}
          {request?.additional_notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                <Icon name="MessageSquare" size={15} className="text-primary" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notes</h4>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
                {request?.additional_notes}
              </p>
            </div>
          )}

          {/* Audit Trail */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
              <Icon name="History" size={15} className="text-primary" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Audit Trail</h4>
            </div>
            {auditLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Icon name="Loader2" size={14} className="animate-spin" />
                Loading audit log…
              </div>
            )}
            {!auditLoading && auditLog?.length === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">No audit events recorded yet.</p>
            )}
            {!auditLoading && auditLog?.map((entry) => (
              <div key={entry?.id} className="flex gap-3 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{entry?.event_type}</span>
                  {(entry?.old_status || entry?.new_status) && (
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      {entry?.old_status && `${entry?.old_status} → `}{entry?.new_status}
                    </span>
                  )}
                  <div className="text-gray-500 dark:text-gray-400 mt-0.5">
                    {entry?.performed_by_name || entry?.performed_by_email || '—'} · {fmtDateTime(entry?.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        {isCancellable && (
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">Phase 3A: Start/Continue/Complete verification above</p>
            <button
              onClick={() => setShowCancelModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
            >
              <Icon name="XCircle" size={15} />
              Cancel Request
            </button>
          </div>
        )}
      </div>
      <CancelModal
        isOpen={showCancelModal}
        onConfirm={handleCancel}
        onCancel={() => setShowCancelModal(false)}
        loading={cancelling}
      />
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
    </>
  );
}
