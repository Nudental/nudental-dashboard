/**
 * dentrixUploadService.js
 * Phase 5C-C — Dentrix Upload UI — real-upload-ready (backend still disabled).
 *
 * Hard constraints:
 * - Sends dry_run: false for upload_document (real upload attempt).
 * - Backend is still disabled (DENTRIX_UPLOAD_ENABLED=false) → returns 403.
 * - Never marks anything as uploaded unless backend returns real success with Dentrix document ID.
 * - Never updates Dentrix metadata client-side.
 * - Never writes audit events from frontend.
 * - 403 "upload disabled" is handled gracefully — not treated as a validation failure.
 */

import { format } from 'date-fns';
import { generateInsuranceVerificationPDF } from './insuranceVerificationPDFService';
import { supabase } from '../lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const DENTRIX_ENDPOINT =
  'https://siwtadgdqtvxoztnxzhx.functions.supabase.co/insurance-upload-to-dentrix';

const PDF_TEMPLATE_VERSION = 'V507';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load the Nu Dental logo as a base64 data URL for embedding in jsPDF.
 * Returns null if loading fails (non-fatal).
 */
async function loadLogoDataURL() {
  try {
    let response = await fetch('/assets/images/thenudental-logo-color__1_-1778797289362.png');
    if (!response?.ok) return null;
    const blob = await response?.blob();
    const dataURL = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataURL) return null;
    const nativeDims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataURL;
    });
    return { dataURL, nativeDims };
  } catch {
    return null;
  }
}

/**
 * Compute SHA-256 checksum of an ArrayBuffer.
 * Returns hex string or null if SubtleCrypto unavailable.
 */
async function computeSHA256(arrayBuffer) {
  try {
    const hashBuffer = await crypto?.subtle?.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray?.map((b) => b?.toString(16)?.padStart(2, '0'))?.join('');
  } catch {
    return null;
  }
}

/**
 * Convert Uint8Array to raw base64 string (no data URI prefix).
 */
function uint8ToBase64(uint8Array) {
  const binaryString = Array.from(uint8Array)
    ?.map((b) => String.fromCharCode(b))
    ?.join('');
  return btoa(binaryString);
}

/**
 * Build the pdf_filename_base (no .pdf extension).
 * Format: InsuranceVerification_Last_First_YYYYMMDD
 */
function buildDentrixFilenameBase(verification, request) {
  const firstName =
    verification?.patient_name?.split(' ')?.[0] ||
    request?.patient_first_name ||
    'Unknown';
  const lastName =
    verification?.patient_name?.split(' ')?.slice(1)?.join('_') ||
    request?.patient_last_name ||
    'Patient';
  const dateStr = verification?.completed_at
    ? format(new Date(verification.completed_at), 'yyyyMMdd')
    : format(new Date(), 'yyyyMMdd');
  const lastClean = lastName?.replace(/\s+/g, '_')?.replace(/[^a-zA-Z0-9_]/g, '');
  const firstClean = firstName?.replace(/\s+/g, '_')?.replace(/[^a-zA-Z0-9_]/g, '');
  return `InsuranceVerification_${lastClean}_${firstClean}_${dateStr}`;
}

// ─── 1. Lookup Patient ────────────────────────────────────────────────────────

/**
 * Call lookup_patient action on the Dentrix upload edge function.
 *
 * @param {string} verificationId
 * @param {string} requestId
 * @returns {object} full response from edge function
 */
export async function lookupDentrixPatientForVerification(verificationId, requestId) {
  if (!verificationId) throw new Error('verificationId is required for Dentrix patient lookup.');
  if (!requestId) throw new Error('requestId is required for Dentrix patient lookup.');

  // Fetch current Supabase session — required for Authorization header
  const { data: sessionData } = await supabase?.auth?.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('You must be signed in to use Dentrix upload.');
  }

  let response;
  try {
    response = await fetch(DENTRIX_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'lookup_patient',
        verification_id: verificationId,
        request_id: requestId,
        log_audit: false,
      }),
    });
  } catch (networkErr) {
    throw new Error(`Network error during Dentrix patient lookup: ${networkErr?.message}`);
  }

  let data;
  try {
    data = await response?.json();
  } catch {
    throw new Error(`Dentrix lookup returned non-JSON response (HTTP ${response.status}).`);
  }

  if (!response?.ok) {
    const msg = data?.error || data?.message || `HTTP ${response?.status}`;
    if (response?.status === 403) {
      throw new Error(`Dentrix lookup blocked (403): ${msg}`);
    }
    throw new Error(`Dentrix lookup failed (${response.status}): ${msg}`);
  }

  if (!data?.ok) {
    throw new Error(data?.error || data?.message || 'Dentrix lookup returned ok=false.');
  }

  return data;
}

// ─── 2. Real Upload (dry_run: false) ─────────────────────────────────────────

/**
 * Generate a fresh V507-branded PDF and call upload_document with dry_run: false.
 *
 * Backend is still disabled (DENTRIX_UPLOAD_ENABLED=false) → returns 403.
 * The caller must handle 403 gracefully — it is NOT a validation failure.
 *
 * On real backend success: returns { uploaded: true, dentrixDocumentId, ... }
 * On 403 disabled: throws error with code UPLOAD_DISABLED
 * On duplicate: throws error with code ALREADY_UPLOADED
 *
 * NEVER marks anything as uploaded unless backend returns real success with Dentrix document ID.
 * NEVER updates metadata client-side.
 *
 * @param {object} verification - insurance_verifications record (must be completed)
 * @param {object} request      - insurance_verification_requests record
 * @param {object} confirmedPatientSnapshot - patient snapshot from lookup modal
 * @returns {object} upload result from edge function
 */
export async function runDentrixRealUpload(verification, request, confirmedPatientSnapshot) {
  if (!verification) throw new Error('No verification record provided.');
  if (verification?.status !== 'completed') {
    throw new Error('Only completed verifications can be uploaded to Dentrix.');
  }
  if (!confirmedPatientSnapshot?.dentrix_patient_id) {
    throw new Error('A confirmed Dentrix patient must be selected before upload.');
  }

  // Fetch current Supabase session — required for Authorization header
  const { data: sessionData } = await supabase?.auth?.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) {
    throw new Error('You must be signed in to use Dentrix upload.');
  }

  // Step 1: Load logo (non-fatal)
  let logoResult = null;
  try {
    logoResult = await loadLogoDataURL();
  } catch {
    // non-fatal
  }

  // Step 2: Generate fresh V507-branded PDF (same as Download PDF)
  let doc;
  try {
    doc = generateInsuranceVerificationPDF(verification, request, logoResult);
  } catch (pdfErr) {
    throw new Error(`PDF generation failed: ${pdfErr?.message}`);
  }

  // Step 3: Get raw PDF bytes
  const pdfArrayBuffer = doc?.output('arraybuffer');
  const pdfUint8 = new Uint8Array(pdfArrayBuffer);

  // Step 4: Compute SHA-256 checksum
  const pdfChecksum = await computeSHA256(pdfArrayBuffer);
  if (!pdfChecksum) {
    throw new Error('Could not compute PDF checksum. SubtleCrypto may be unavailable.');
  }

  // Step 5: Convert to raw base64 (no data URI prefix)
  let pdfBase64;
  try {
    pdfBase64 = uint8ToBase64(pdfUint8);
  } catch (encErr) {
    throw new Error(`Failed to encode PDF as base64: ${encErr?.message}`);
  }

  const pdfSizeBytes = pdfUint8?.byteLength;
  const pdfFilenameBase = buildDentrixFilenameBase(verification, request);

  // Step 6: Call upload_document with dry_run: false
  // Backend is still disabled → expected to return 403 until Yabezy enables uploads.
  const body = {
    action: 'upload_document',
    verification_id: verification?.id,
    request_id: request?.id,
    dentrix_patient_id: confirmedPatientSnapshot?.dentrix_patient_id,
    confirmed_patient_snapshot: confirmedPatientSnapshot,
    pdf_base64: pdfBase64,
    pdf_checksum_sha256: pdfChecksum,
    pdf_size_bytes: pdfSizeBytes,
    pdf_filename_base: pdfFilenameBase,
    pdf_template_version: PDF_TEMPLATE_VERSION,
    dry_run: false, // Real upload attempt — backend still disabled, expected 403
  };

  let response;
  try {
    response = await fetch(DENTRIX_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new Error(`Network error during Dentrix upload: ${networkErr?.message}`);
  }

  let data;
  try {
    data = await response?.json();
  } catch {
    throw new Error(`Dentrix upload returned non-JSON response (HTTP ${response.status}).`);
  }

  // 403 — upload disabled by backend safety setting
  if (response?.status === 403) {
    const msg = data?.error || data?.message || 'Dentrix upload is disabled.';
    const err = new Error(msg);
    err.code = 'UPLOAD_DISABLED';
    throw err;
  }

  if (!response?.ok) {
    const msg = data?.error || data?.message || `HTTP ${response?.status}`;

    // Parse specific error types
    if (
      msg?.toLowerCase()?.includes('already uploaded') ||
      msg?.toLowerCase()?.includes('duplicate') ||
      data?.already_uploaded
    ) {
      const err = new Error(`Duplicate: This verification has already been uploaded to Dentrix. ${msg}`);
      err.code = 'ALREADY_UPLOADED';
      throw err;
    }
    if (msg?.toLowerCase()?.includes('inactive')) {
      const err = new Error(`Inactive patient: Only inactive Dentrix record matched — upload blocked. ${msg}`);
      err.code = 'INACTIVE_PATIENT';
      throw err;
    }
    if (msg?.toLowerCase()?.includes('template') || msg?.toLowerCase()?.includes('version')) {
      const err = new Error(`Stale template: PDF template version rejected. ${msg}`);
      err.code = 'STALE_TEMPLATE';
      throw err;
    }
    if (msg?.toLowerCase()?.includes('snapshot') || msg?.toLowerCase()?.includes('mismatch')) {
      const err = new Error(`Snapshot mismatch: Patient data mismatch detected. ${msg}`);
      err.code = 'SNAPSHOT_MISMATCH';
      throw err;
    }
    if (msg?.toLowerCase()?.includes('location')) {
      const err = new Error(`Location mismatch: Office/location mismatch detected. ${msg}`);
      err.code = 'LOCATION_MISMATCH';
      throw err;
    }
    throw new Error(`Dentrix upload failed (${response.status}): ${msg}`);
  }

  // Real success — backend returned success with Dentrix document ID
  // Do NOT fake metadata client-side. Caller must refresh from Supabase.
  return {
    uploaded: data?.ok !== false,
    dentrixDocumentId: data?.dentrix_document_id || data?.document_id || null,
    patientName: `${confirmedPatientSnapshot?.firstName || ''} ${confirmedPatientSnapshot?.lastName || ''}`?.trim(),
    chartNumber: confirmedPatientSnapshot?.chartNumber,
    dentrixPatientId: confirmedPatientSnapshot?.dentrix_patient_id,
    pdfFilenameBase,
    pdfSizeBytes,
    pdfChecksum,
    rawResponse: data,
  };
}

// Backward-compat alias (used by existing modal wiring)
export const runDentrixUploadDryRun = runDentrixRealUpload;

// ─── 3. Upload Status Display Helpers ────────────────────────────────────────

/**
 * Derive the Dentrix upload status label for display.
 * Never returns "Uploaded" based on a failed or disabled upload attempt.
 *
 * @param {object} verification - insurance_verifications record
 * @param {object} request      - insurance_verification_requests record
 * @returns {{ label: string, color: string, icon: string }}
 */
export function getDentrixUploadStatus(verification, request) {
  const uploadStatus =
    verification?.dentrix_document_upload_status ||
    request?.dentrix_document_upload_status ||
    null;

  if (!uploadStatus || uploadStatus === 'not_uploaded') {
    return {
      label: 'Not uploaded',
      color: 'text-text-secondary',
      badgeColor: 'bg-gray-100 text-gray-600 border-gray-200',
      icon: 'Upload',
    };
  }
  if (uploadStatus === 'uploaded') {
    return {
      label: 'Uploaded to Dentrix',
      color: 'text-emerald-700',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: 'CheckCircle',
    };
  }
  if (uploadStatus === 'failed') {
    return {
      label: 'Upload failed',
      color: 'text-red-700',
      badgeColor: 'bg-red-100 text-red-800 border-red-200',
      icon: 'XCircle',
    };
  }
  if (uploadStatus === 'manual_uploaded') {
    return {
      label: 'Manually uploaded',
      color: 'text-blue-700',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: 'Upload',
    };
  }
  if (uploadStatus === 'not_ready') {
    return {
      label: 'Not ready',
      color: 'text-text-secondary',
      badgeColor: 'bg-gray-100 text-gray-500 border-gray-200',
      icon: 'Clock',
    };
  }
  return {
    label: uploadStatus,
    color: 'text-text-secondary',
    badgeColor: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: 'Upload',
  };
}
