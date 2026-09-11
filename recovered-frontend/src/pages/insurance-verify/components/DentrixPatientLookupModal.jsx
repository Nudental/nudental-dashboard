/**
 * DentrixPatientLookupModal.jsx
 * Phase 5C-B — Dentrix Upload UI — Patient Lookup Modal
 *
 * Displays lookup_patient results and requires user confirmation before any dry-run.
 * Never auto-uploads. Never proceeds without user selection/confirmation.
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

const fmtDateTime = (v) => {
  if (!v) return '—';
  try { return format(new Date(v), 'MM/dd/yyyy h:mm a'); } catch { return String(v); }
};

// ─── Patient Card ─────────────────────────────────────────────────────────────

const PatientCard = ({ patient, isSelected, onSelect, disabled }) => {
  const isActive = patient?.patientStatus === 'ACTIVE';
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
          : disabled
          ? 'border-gray-200 bg-gray-100 dark:bg-gray-800 opacity-60 cursor-not-allowed' :'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
            isActive
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :'bg-gray-100 text-gray-600 border-gray-200'
          }`}>
            {fmt(patient?.patientStatus)}
          </span>
          {isSelected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Icon name="CheckCircle" size={10} />
              Selected
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">ID: {fmt(patient?.dentrix_patient_id)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400 font-medium">Name: </span>
          <span className="text-gray-900 dark:text-gray-100 font-semibold">{fmt(patient?.firstName)} {fmt(patient?.lastName)}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 font-medium">DOB: </span>
          <span className="text-gray-900 dark:text-gray-100">{fmtDate(patient?.dateOfBirth)}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 font-medium">Chart #: </span>
          <span className="text-gray-900 dark:text-gray-100 font-mono font-semibold">{fmt(patient?.chartNumber)}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 font-medium">Office: </span>
          <span className="text-gray-900 dark:text-gray-100">{fmt(patient?.preferredLocationName)}</span>
        </div>
        {patient?.lastModified && (
          <div className="col-span-2">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Last Modified: </span>
            <span className="text-gray-900 dark:text-gray-100">{fmtDateTime(patient?.lastModified)}</span>
          </div>
        )}
      </div>
    </button>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

/**
 * DentrixPatientLookupModal
 *
 * Props:
 * - isOpen: boolean
 * - loading: boolean — true while lookup is in progress
 * - lookupError: string|null — error from lookup call
 * - lookupResult: object|null — full response from lookupDentrixPatientForVerification
 * - onConfirm: (patientSnapshot) => void — called with selected patient snapshot
 * - onCancel: () => void
 */
export default function DentrixPatientLookupModal({
  isOpen,
  loading,
  lookupError,
  lookupResult,
  onConfirm,
  onCancel,
}) {
  const [selectedPatient, setSelectedPatient] = useState(null);

  if (!isOpen) return null;

  const dentrix = lookupResult?.dentrix || null;
  const grouped = dentrix?.grouped_matches || {};
  const activeExact = grouped?.active_exact_matches || [];
  const inactiveMatches = grouped?.inactive_matches || [];
  const partialOrAmbiguous = grouped?.partial_or_ambiguous_matches || [];
  const recommended = dentrix?.recommended_match || null;
  const requiresSelection = dentrix?.requires_user_selection || false;
  const requiresConfirmation = dentrix?.requires_frontend_confirmation || false;
  const blockedReason = dentrix?.blocked_reason || null;

  // Determine if continue is allowed
  const allMatches = [...activeExact, ...partialOrAmbiguous];
  const hasActiveMatches = activeExact?.length > 0;
  const onlyInactiveMatches = !hasActiveMatches && inactiveMatches?.length > 0;

  const canContinue =
    !loading &&
    !lookupError &&
    !blockedReason &&
    !onlyInactiveMatches &&
    !!selectedPatient &&
    selectedPatient?.patientStatus === 'ACTIVE';

  const handleConfirm = () => {
    if (!canContinue || !selectedPatient) return;
    // Build confirmed_patient_snapshot
    const snapshot = {
      dentrix_patient_id: selectedPatient?.dentrix_patient_id,
      patientStatus: selectedPatient?.patientStatus || 'ACTIVE',
      firstName: selectedPatient?.firstName || '',
      lastName: selectedPatient?.lastName || '',
      dateOfBirth: selectedPatient?.dateOfBirth || null,
      chartNumber: selectedPatient?.chartNumber || '',
      preferredLocationId: selectedPatient?.preferredLocationId || '',
      preferredLocationName: selectedPatient?.preferredLocationName || '',
    };
    onConfirm?.(snapshot);
  };

  // Auto-select recommended match if only one active match and no selection yet
  const effectiveSelected = selectedPatient || (
    !requiresSelection && recommended && recommended?.patientStatus === 'ACTIVE'
      ? recommended
      : null
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] w-full max-w-lg border border-gray-300 dark:border-gray-700 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <Icon name="Search" size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Dentrix Patient Lookup</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Select the matching Dentrix patient record</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
          >
            <Icon name="X" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Icon name="Loader2" size={28} className="animate-spin text-indigo-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Looking up patient in Dentrix…</p>
            </div>
          )}

          {/* Lookup error */}
          {!loading && lookupError && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              <Icon name="AlertCircle" size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Lookup Failed</p>
                <p className="mt-0.5 text-xs">{lookupError}</p>
              </div>
            </div>
          )}

          {/* Blocked reason */}
          {!loading && !lookupError && blockedReason && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              <Icon name="Ban" size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Upload Blocked</p>
                <p className="mt-0.5 text-xs">{blockedReason}</p>
              </div>
            </div>
          )}

          {/* Only inactive matches */}
          {!loading && !lookupError && !blockedReason && onlyInactiveMatches && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <Icon name="AlertTriangle" size={16} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Upload Blocked — Inactive Patient</p>
                <p className="mt-0.5 text-xs">Only inactive Dentrix record matched — upload blocked.</p>
              </div>
            </div>
          )}

          {/* Active matches */}
          {!loading && !lookupError && !blockedReason && hasActiveMatches && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Active Matches ({activeExact?.length})
              </p>
              {activeExact?.map((patient, i) => (
                <PatientCard
                  key={patient?.dentrix_patient_id || i}
                  patient={patient}
                  isSelected={
                    (selectedPatient || effectiveSelected)?.dentrix_patient_id ===
                    patient?.dentrix_patient_id
                  }
                  onSelect={() => setSelectedPatient(patient)}
                  disabled={false}
                />
              ))}
            </div>
          )}

          {/* Partial / ambiguous matches */}
          {!loading && !lookupError && !blockedReason && partialOrAmbiguous?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Partial / Ambiguous Matches ({partialOrAmbiguous?.length})
              </p>
              {partialOrAmbiguous?.map((patient, i) => (
                <PatientCard
                  key={patient?.dentrix_patient_id || i}
                  patient={patient}
                  isSelected={
                    (selectedPatient || effectiveSelected)?.dentrix_patient_id ===
                    patient?.dentrix_patient_id
                  }
                  onSelect={() =>
                    patient?.patientStatus === 'ACTIVE' ? setSelectedPatient(patient) : null
                  }
                  disabled={patient?.patientStatus !== 'ACTIVE'}
                />
              ))}
            </div>
          )}

          {/* Inactive matches (display only, not selectable) */}
          {!loading && !lookupError && !blockedReason && inactiveMatches?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Inactive Matches ({inactiveMatches?.length}) — Not selectable
              </p>
              {inactiveMatches?.map((patient, i) => (
                <PatientCard
                  key={patient?.dentrix_patient_id || i}
                  patient={patient}
                  isSelected={false}
                  onSelect={null}
                  disabled
                />
              ))}
            </div>
          )}

          {/* No matches */}
          {!loading && !lookupError && !blockedReason && !onlyInactiveMatches &&
            allMatches?.length === 0 && inactiveMatches?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400 dark:text-gray-500">
              <Icon name="UserX" size={28} />
              <p className="text-sm">No Dentrix patient matches found.</p>
            </div>
          )}

          {/* Confirmation required notice */}
          {!loading && !lookupError && !blockedReason && !onlyInactiveMatches && hasActiveMatches && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs">
              <Icon name="Info" size={12} className="mt-0.5 flex-shrink-0" />
              <span>
                {requiresSelection
                  ? 'Multiple matches found — please select the correct patient before continuing.'
                  : 'Please confirm the matched patient record before continuing.'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canContinue}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="ArrowRight" size={14} />
            Continue to Confirmation
          </button>
        </div>
      </div>
    </div>
  );
}
