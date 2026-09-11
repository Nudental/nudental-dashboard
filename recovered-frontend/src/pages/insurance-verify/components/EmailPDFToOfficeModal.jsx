/**
 * EmailPDFToOfficeModal.jsx
 * Phase 4B — Confirmation modal before emailing the completed insurance verification PDF to the office.
 *
 * Shows:
 * - To email (editable if user has email_office permission)
 * - Office name
 * - Patient name
 * - Insurance company
 * - Completed at
 * - PDF filename
 * - Subject preview
 * - Warning message
 *
 * Buttons: Cancel | Confirm & Send
 */

import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import Icon from '../../../components/AppIcon';
import { buildInsurancePDFFilename } from '../../../services/insuranceVerificationPDFService';

const fmtDateTime = (v) => {
  if (!v) return '—';
  try { return format(parseISO(v), 'MM/dd/yyyy h:mm a'); } catch { return String(v); }
};

const fmtDate = (v) => {
  if (!v) return '—';
  try {
    const d = v?.includes('T') ? parseISO(v) : new Date(v + 'T12:00:00');
    return format(d, 'MM/dd/yyyy');
  } catch { return String(v); }
};

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object} props.verification - insurance_verifications record
 * @param {object} props.request - insurance_verification_requests record
 * @param {string} props.defaultRecipient - resolved office email
 * @param {boolean} props.canOverrideRecipient - allow manual override
 * @param {boolean} props.sending - loading state
 * @param {function} props.onConfirm - (recipientEmail) => void
 * @param {function} props.onCancel
 */
export default function EmailPDFToOfficeModal({
  isOpen,
  verification,
  request,
  defaultRecipient,
  canOverrideRecipient = false,
  sending = false,
  onConfirm,
  onCancel,
}) {
  const [recipientEmail, setRecipientEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(defaultRecipient || '');
    }
  }, [isOpen, defaultRecipient]);

  if (!isOpen) return null;

  const patientName = verification?.patient_name || request?.patient_name ||
    [request?.patient_first_name, request?.patient_last_name]?.filter(Boolean)?.join(' ') || '—';
  const officeName = verification?.office || request?.office_name || '—';
  const insuranceCompany = verification?.insurance_name || request?.insurance_company_name || '—';
  const completedAt = fmtDateTime(verification?.completed_at);
  const patientDob = fmtDate(verification?.patient_dob || request?.patient_dob);
  const filename = buildInsurancePDFFilename(verification, request);
  const subjectPreview = `Completed Insurance Verification Form — ${patientName} — ${officeName}`;

  const emailMissing = !recipientEmail?.trim();
  const canSend = !emailMissing && !sending;

  const handleConfirm = () => {
    if (!canSend) return;
    onConfirm?.(recipientEmail?.trim());
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-primary rounded-xl shadow-2xl w-full max-w-lg border border-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <Icon name="Send" size={20} className="text-teal-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Email PDF to Office</h3>
            <p className="text-xs text-text-secondary">Review details before sending the completed verification PDF.</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Icon name="AlertTriangle" size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              This will email the completed insurance verification PDF to the office. Verify the recipient before sending.
            </p>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              To (Office Email)
              {!canOverrideRecipient && <span className="ml-1 text-text-tertiary font-normal">(read-only)</span>}
            </label>
            {canOverrideRecipient ? (
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e?.target?.value)}
                placeholder="office@example.com"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={sending}
              />
            ) : (
              <div className={`px-3 py-2 text-sm rounded-lg border ${emailMissing ? 'border-red-300 bg-red-50 text-red-700' : 'border-border bg-surface-secondary text-text-primary'}`}>
                {emailMissing ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="AlertCircle" size={13} className="text-red-500" />
                    Office email missing — cannot send
                  </span>
                ) : recipientEmail}
              </div>
            )}
          </div>

          {/* Details table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <DetailRow label="Office" value={officeName} />
                <DetailRow label="Patient Name" value={patientName} />
                <DetailRow label="Date of Birth" value={patientDob} />
                <DetailRow label="Insurance Company" value={insuranceCompany} />
                <DetailRow label="Completed At" value={completedAt} />
                <DetailRow label="Completed By" value={verification?.completed_by_name || verification?.completed_by_email || '—'} />
                <DetailRow label="PDF Filename" value={filename} mono />
              </tbody>
            </table>
          </div>

          {/* Subject preview */}
          <div>
            <p className="text-xs font-semibold text-text-secondary mb-1">Subject Preview</p>
            <div className="px-3 py-2 rounded-lg bg-surface-secondary border border-border text-xs text-text-primary font-mono break-all">
              {subjectPreview}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-border flex-shrink-0 justify-end">
          <button
            onClick={onCancel}
            disabled={sending}
            className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSend}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? <><Icon name="Loader2" size={14} className="animate-spin" />Sending…</>
              : <><Icon name="Send" size={14} />Confirm &amp; Send</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Row helper ────────────────────────────────────────────────────────

function DetailRow({ label, value, mono = false }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2 bg-surface-secondary text-xs font-semibold text-text-secondary w-2/5 align-top">
        {label}
      </td>
      <td className={`px-3 py-2 text-xs text-text-primary break-all ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </td>
    </tr>
  );
}
