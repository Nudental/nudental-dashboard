/**
 * DentrixUploadConfirmModal.jsx
 * Phase 5C-C — Dentrix Upload UI — Real-Upload-Ready Confirmation Modal
 *
 * - Button text: "Upload PDF to Dentrix" * - Modal title:"Confirm Dentrix Upload"
 * - Requires confirmation checkbox before enabling upload
 * - Handles 403 backend-disabled gracefully (no uploaded badge, no metadata update)
 * - On real backend success: shows Uploaded badge with Dentrix document ID
 */

import React, { useState } from 'react';
import { format } from 'date-fns';
import Icon from '../../../components/AppIcon';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : '—';

const fmtDate = (v) => {
  if (!v) return '—';
  try {
    const d = v?.includes('T') ? new Date(v) : new Date(v + 'T12:00:00');
    return format(d, 'MM/dd/yyyy');
  } catch { return String(v); }
};

const DetailRow = ({ label, value, mono = false }) => (
  <div className="flex justify-between items-start gap-3 py-1.5 border-b border-gray-200 dark:border-gray-700 last:border-0">
    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium flex-shrink-0">{label}</span>
    <span className={`text-xs text-gray-900 dark:text-gray-100 font-semibold text-right ${mono ? 'font-mono' : ''}`}>{fmt(value)}</span>
  </div>
);

// ─── Upload Result Panel ──────────────────────────────────────────────────────

const UploadResultPanel = ({ result, error }) => {
  if (error) {
    // Determine error category
    let title = 'Upload Failed';
    let detail = error;
    let isDisabled = false;

    if (
      error?.toLowerCase()?.includes('upload is disabled') ||
      error?.toLowerCase()?.includes('dentrix upload is disabled') ||
      error?.toLowerCase()?.includes('upload_disabled') ||
      error?.toLowerCase()?.includes('403') ||
      error?.toLowerCase()?.includes('blocked')
    ) {
      title = 'Upload Ready — Backend Disabled';
      detail = 'Upload is ready but currently disabled by backend safety setting. Ask admin to enable Dentrix upload.';
      isDisabled = true;
    } else if (error?.toLowerCase()?.includes('already uploaded') || error?.toLowerCase()?.includes('duplicate')) {
      title = 'Already Uploaded to Dentrix';
      detail = error;
    } else if (error?.toLowerCase()?.includes('inactive')) {
      title = 'Inactive Patient — Upload Blocked';
      detail = error;
    } else if (error?.toLowerCase()?.includes('template') || error?.toLowerCase()?.includes('version')) {
      title = 'Stale Template Rejected';
      detail = error;
    } else if (error?.toLowerCase()?.includes('snapshot') || error?.toLowerCase()?.includes('mismatch')) {
      title = 'Snapshot Mismatch';
      detail = error;
    } else if (error?.toLowerCase()?.includes('location')) {
      title = 'Location Mismatch';
      detail = error;
    } else if (error?.toLowerCase()?.includes('permission') || error?.toLowerCase()?.includes('unauthorized')) {
      title = 'Permission Denied';
      detail = error;
    } else if (error?.toLowerCase()?.includes('network') || error?.toLowerCase()?.includes('fetch')) {
      title = 'Network Error';
      detail = error;
    }

    if (isDisabled) {
      return (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <Icon name="ShieldOff" size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-0.5 text-xs">{detail}</p>
            <p className="mt-1 text-xs text-amber-600 italic">
              Dentrix upload is currently disabled by backend safety setting. No document was created.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
        <Icon name="XCircle" size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-xs">{detail}</p>
          <p className="mt-1 text-xs text-red-600 italic">No Dentrix document was created.</p>
        </div>
      </div>
    );
  }

  if (result?.uploaded) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
        <Icon name="CheckCircle" size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold">Uploaded to Dentrix</p>
          <p className="mt-0.5 text-xs">
            Successfully uploaded to patient{' '}
            <strong>{result?.patientName || '—'}</strong>
            {result?.chartNumber ? ` (Chart #${result?.chartNumber})` : ''}.
          </p>
          {result?.dentrixDocumentId && (
            <p className="mt-0.5 text-xs text-emerald-700 font-mono">
              Dentrix Document ID: {result?.dentrixDocumentId}
            </p>
          )}
          {result?.pdfFilenameBase && (
            <p className="mt-0.5 text-xs text-emerald-600">
              PDF: {result?.pdfFilenameBase}.pdf
              {result?.pdfSizeBytes ? ` (${Math.round(result?.pdfSizeBytes / 1024)} KB)` : ''}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

/**
 * DentrixUploadConfirmModal
 *
 * Props:
 * - isOpen: boolean
 * - patientSnapshot: object — confirmed patient from lookup modal
 * - verification: object — insurance_verifications record
 * - request: object — insurance_verification_requests record
 * - running: boolean — true while upload is in progress
 * - uploadResult: object|null — result from runDentrixRealUpload (success)
 * - uploadError: string|null — error from upload attempt
 * - onConfirm: () => void — trigger real upload
 * - onCancel: () => void
 * - onClose: () => void — close after result shown
 *
 * Legacy prop aliases (backward compat):
 * - dryRunResult → uploadResult
 * - dryRunError → uploadError
 */
export default function DentrixUploadConfirmModal({
  isOpen,
  patientSnapshot,
  verification,
  request,
  running,
  uploadResult,
  uploadError,
  // Legacy aliases from Phase 5C-B wiring
  dryRunResult,
  dryRunError,
  onConfirm,
  onCancel,
  onClose,
}) {
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  // Support legacy prop names
  const result = uploadResult ?? dryRunResult ?? null;
  const error = uploadError ?? dryRunError ?? null;

  const hasResult = !!result || !!error;

  const patientName = `${patientSnapshot?.firstName || ''} ${patientSnapshot?.lastName || ''}`?.trim() || '—';
  const officeName = patientSnapshot?.preferredLocationName || '—';
  const pdfFilenameBase = (() => {
    if (!verification || !request) return '—';
    try {
      const firstName = verification?.patient_name?.split(' ')?.[0] || request?.patient_first_name || 'Unknown';
      const lastName = verification?.patient_name?.split(' ')?.slice(1)?.join('_') || request?.patient_last_name || 'Patient';
      const dateStr = verification?.completed_at
        ? format(new Date(verification.completed_at), 'yyyyMMdd')
        : format(new Date(), 'yyyyMMdd');
      const lastClean = lastName?.replace(/\s+/g, '_')?.replace(/[^a-zA-Z0-9_]/g, '');
      const firstClean = firstName?.replace(/\s+/g, '_')?.replace(/[^a-zA-Z0-9_]/g, '');
      return `InsuranceVerification_${lastClean}_${firstClean}_${dateStr}`;
    } catch { return '—'; }
  })();

  const handleClose = () => {
    setConfirmed(false);
    onClose?.();
  };

  const handleCancel = () => {
    setConfirmed(false);
    onCancel?.();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] w-full max-w-md border border-gray-300 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <Icon name="Upload" size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Confirm Dentrix Upload</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Review patient and PDF before uploading</p>
            </div>
          </div>
          {hasResult && (
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
            >
              <Icon name="X" size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Warning banner */}
          {!hasResult && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <Icon name="AlertTriangle" size={13} className="mt-0.5 flex-shrink-0" />
              <span>
                <strong>This will upload the completed insurance verification PDF to the selected Dentrix patient's Document Center.</strong>
                {' '}Verify the patient record carefully before confirming.
              </span>
            </div>
          )}

          {/* Patient details */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Patient</p>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 space-y-0">
              <DetailRow label="Name" value={patientName} />
              <DetailRow label="DOB" value={fmtDate(patientSnapshot?.dateOfBirth)} />
              <DetailRow label="Chart #" value={patientSnapshot?.chartNumber} mono />
              <DetailRow label="Status" value={patientSnapshot?.patientStatus} />
              <DetailRow label="Office / Location" value={officeName} />
              <DetailRow label="Dentrix Patient ID" value={patientSnapshot?.dentrix_patient_id} mono />
            </div>
          </div>

          {/* PDF details */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">PDF</p>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 space-y-0">
              <DetailRow label="Filename" value={`${pdfFilenameBase}.pdf`} />
              <DetailRow label="Template" value="V507 (current branded)" />
              <DetailRow label="Tag" value="Insurance" />
            </div>
          </div>

          {/* Confirmation checkbox — only shown before result */}
          {!hasResult && (
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e?.target?.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                I confirm this is the correct active Dentrix patient and chart.
              </span>
            </label>
          )}

          {/* Upload result */}
          {hasResult && (
            <UploadResultPanel result={result} error={error} />
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 justify-end">
          {!hasResult ? (
            <>
              <button
                onClick={handleCancel}
                disabled={running}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={running || !confirmed}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!confirmed ? 'Check the confirmation box to enable upload' : undefined}
              >
                {running
                  ? <Icon name="Loader2" size={14} className="animate-spin" />
                  : <Icon name="Upload" size={14} />
                }
                {running ? 'Uploading…' : 'Upload PDF to Dentrix'}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
