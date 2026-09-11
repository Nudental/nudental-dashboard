/**
 * insuranceVerificationPDFService.js
 * Phase 4A — PDF generation for completed Nu Dental Insurance Verification forms.
 * V504A — Branding polish: Nu Dental logo top-right + Nu Dental theme colors.
 *
 * Constraints:
 * - User-triggered only. No automatic generation on page load.
 * - Only available for completed verifications (status = 'completed').
 * - No emails sent. No Dentrix upload. No POST /v1/documents.
 * - Missing/null values render as '—', never fake values. * - Attempts to store PDF in private Supabase storage bucket'insurance-verifications'.
 * - Updates pdf_storage_path, pdf_generated_at, pdf_checksum_sha256 if storage succeeds.
 * - Falls back to browser download only if storage upload fails.
 * - Inserts audit log events: pdf_generated, pdf_downloaded.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { insertAuditLog } from './insuranceVerifyService';

// ─── Nu Dental Brand / Color Palette ─────────────────────────────────────────
// 2905C ≈ #8DC8E8  (light sky blue)
// 630C  ≈ #77C5D5  (medium teal-blue)
// 324C  ≈ #9CDBD9  (soft teal)

const BRAND = {
  // Nu Dental palette
  nuBlue:       [141, 200, 232],   // 2905C  #8DC8E8
  nuTeal:       [119, 197, 213],   // 630C   #77C5D5
  nuMint:       [156, 219, 217],   // 324C   #9CDBD9
  // Deep header background — dark navy for contrast with white text
  headerBg:     [18, 52, 86],      // deep navy (keeps white text readable)
  headerBgAlt:  [24, 68, 110],     // slightly lighter navy for sub-elements
  // Section band uses nuTeal
  sectionBg:    [119, 197, 213],   // 630C
  sectionText:  [10, 40, 70],      // dark navy text on teal band
  // Table header uses nuBlue
  tableHeadBg:  [141, 200, 232],   // 2905C
  tableHeadText:[10, 40, 70],      // dark navy text on light blue
  // Accent / divider uses nuMint
  accent:       [156, 219, 217],   // 324C
  // Neutrals
  white:        [255, 255, 255],
  offWhite:     [245, 250, 252],
  lightGray:    [241, 245, 249],
  midGray:      [100, 116, 139],
  darkGray:     [30, 41, 59],
  border:       [200, 225, 235],
};

// ─── Logo asset path (public folder, loaded as data URL for jsPDF) ────────────
const LOGO_PUBLIC_PATH = '/assets/images/thenudental-logo-color__1_-1778797289362.png';

/**
 * Load the Nu Dental logo as a base64 data URL for embedding in jsPDF.
 * Also captures the image's native pixel dimensions so the caller can
 * compute a proportional render size without distortion.
 * Returns null if loading fails (non-fatal — header renders without logo).
 */
async function loadLogoDataURL() {
  try {
    const response = await fetch(LOGO_PUBLIC_PATH);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataURL = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataURL) return null;

    // Measure native pixel dimensions via an off-screen Image element
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

// ─── Formatters ───────────────────────────────────────────────────────────────

const dash = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
};

const fmtDate = (v) => {
  if (!v) return '—';
  try {
    const d = v?.includes('T') ? parseISO(v) : new Date(v + 'T12:00:00');
    return format(d, 'MM/dd/yyyy');
  } catch { return String(v); }
};

const fmtDateTime = (v) => {
  if (!v) return '—';
  try { return format(parseISO(v), 'MM/dd/yyyy h:mm a'); } catch { return String(v); }
};

const fmtDollar = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};

const fmtPct = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  return `${n}%`;
};

const fmtBool = (v) => {
  if (v === null || v === undefined) return '—';
  return v ? 'Yes' : 'No';
};

const fmtCheckboxGroup = (obj) => {
  if (!obj || typeof obj !== 'object') return '—';
  const checked = Object.entries(obj)
    ?.filter(([, v]) => v)
    ?.map(([k]) => k?.charAt(0)?.toUpperCase() + k?.slice(1));
  return checked?.length > 0 ? checked?.join(', ') : '—';
};

// ─── PDF Filename ─────────────────────────────────────────────────────────────

export function buildInsurancePDFFilename(verification, request) {
  const patientName = (
    verification?.patient_name ||
    request?.patient_name ||
    [request?.patient_first_name, request?.patient_last_name]?.filter(Boolean)?.join('_') ||
    'Patient' )?.replace(/\s+/g,'_')?.replace(/[^a-zA-Z0-9_.-]/g, '');

  const dateStr = verification?.completed_at
    ? format(parseISO(verification?.completed_at), 'yyyyMMdd')
    : format(new Date(), 'yyyyMMdd');

  const verificationId = verification?.id?.slice(0, 8) || 'unknown';
  return `NuDental_InsuranceVerification_${patientName}_${dateStr}_${verificationId}.pdf`;
}

// ─── Storage Path ─────────────────────────────────────────────────────────────

function buildStoragePath(verification, request) {
  const filename = buildInsurancePDFFilename(verification, request);
  const verificationId = verification?.id || 'unknown';
  return `verifications/${verificationId}/${filename}`;
}

// ─── Simple SHA-256 checksum (browser SubtleCrypto) ──────────────────────────

async function computeSHA256(arrayBuffer) {
  try {
    const hashBuffer = await crypto?.subtle?.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray?.map((b) => b?.toString(16)?.padStart(2, '0'))?.join('');
  } catch {
    return null;
  }
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

/**
 * Draw the page header.
 * - Deep navy background band
 * - Nu Dental logo top-right (if logoResult provided)
 * - Title "Insurance Verification Form" left of logo
 * - Generated date and CONFIDENTIAL notice
 * - Nu Dental accent stripe at bottom of header band
 */
const drawPageHeader = (doc, pageW, margin, generatedAt, logoResult) => {
  const headerH = 32;

  // Navy header band
  doc?.setFillColor(...BRAND?.headerBg);
  doc?.rect(0, 0, pageW, headerH, 'F');

  // Nu Dental accent stripe at bottom of header (nuTeal)
  doc?.setFillColor(...BRAND?.nuTeal);
  doc?.rect(0, headerH, pageW, 1.5, 'F');

  // ── Logo top-right ──────────────────────────────────────────────────────────
  // Compute render dimensions from native aspect ratio.
  // Max height = 16 mm so the logo fits comfortably inside the 32 mm header band.
  const MAX_LOGO_H = 16; // mm — maximum rendered height
  const MAX_LOGO_W = 50; // mm — maximum rendered width (safety cap)

  let logoW, logoH;

  if (logoResult?.nativeDims?.w && logoResult?.nativeDims?.h) {
    const nativeRatio = logoResult.nativeDims.w / logoResult.nativeDims.h;
    // Start from max height and derive width from true ratio
    logoH = MAX_LOGO_H;
    logoW = logoH * nativeRatio;
    // If width exceeds cap, scale down proportionally
    if (logoW > MAX_LOGO_W) {
      logoW = MAX_LOGO_W;
      logoH = logoW / nativeRatio;
    }
  } else {
    // Fallback safe defaults (only used when native dims unavailable)
    logoH = MAX_LOGO_H;
    logoW = MAX_LOGO_W;
  }

  const logoX = pageW - margin - logoW;
  const logoY = (headerH - logoH) / 2; // vertically centered in band

  if (logoResult?.dataURL) {
    try {
      doc?.addImage(logoResult.dataURL, 'PNG', logoX, logoY, logoW, logoH, undefined, 'FAST');
    } catch {
      // Logo failed to embed — fall back to text
      doc?.setTextColor(...BRAND?.nuBlue);
      doc?.setFontSize(9);
      doc?.setFont('helvetica', 'bold');
      doc?.text('NU DENTAL', logoX + logoW / 2, logoY + logoH / 2 + 1, { align: 'center' });
    }
  } else {
    // No logo data — render compact text fallback
    doc?.setTextColor(...BRAND?.nuBlue);
    doc?.setFontSize(9);
    doc?.setFont('helvetica', 'bold');
    doc?.text('NU DENTAL', logoX + logoW / 2, logoY + logoH / 2 + 1, { align: 'center' });
  }

  // ── Left side: title + metadata ─────────────────────────────────────────────
  const titleAreaRight = logoX - 4; // leave gap before logo

  doc?.setTextColor(...BRAND?.white);
  doc?.setFontSize(13);
  doc?.setFont('helvetica', 'bold');
  doc?.text('Insurance Verification Form', margin, 11);

  doc?.setFontSize(7);
  doc?.setFont('helvetica', 'normal');
  doc?.setTextColor(...BRAND?.nuMint);
  doc?.text(`Generated: ${generatedAt}`, margin, 17);

  doc?.setTextColor(200, 220, 230);
  doc?.text('CONFIDENTIAL — INTERNAL USE ONLY', margin, 22);
  doc?.text('nudashboard.com', margin, 27);

  // Reset text color
  doc?.setTextColor(...BRAND?.darkGray);
};

const drawPageFooter = (doc, pageW, pageH, margin, pageNum, totalPages) => {
  const footerY = pageH - 8;
  // Nu Dental accent line (nuTeal)
  doc?.setDrawColor(...BRAND?.nuTeal);
  doc?.setLineWidth(0.5);
  doc?.line(margin, footerY - 3, pageW - margin, footerY - 3);
  doc?.setFontSize(6.5);
  doc?.setFont('helvetica', 'normal');
  doc?.setTextColor(...BRAND?.midGray);
  doc?.text('Nu Dental Insurance Verification — Confidential', margin, footerY);
  doc?.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, footerY, { align: 'right' });
};

/**
 * Draw a section header band using Nu Dental 630C (nuTeal) with dark navy text.
 */
const drawSectionBand = (doc, text, y, margin, pageW) => {
  doc?.setFillColor(...BRAND?.sectionBg);
  doc?.rect(margin, y, pageW - margin * 2, 7, 'F');
  // Left accent stripe using nuBlue
  doc?.setFillColor(...BRAND?.nuBlue);
  doc?.rect(margin, y, 3, 7, 'F');
  doc?.setTextColor(...BRAND?.sectionText);
  doc?.setFontSize(8);
  doc?.setFont('helvetica', 'bold');
  doc?.text(text?.toUpperCase(), margin + 6, y + 5);
  doc?.setTextColor(...BRAND?.darkGray);
  return y + 7;
};

// ─── Two-column field row helper ──────────────────────────────────────────────

const fieldRow = (doc, label, value, x, y, colW, rowH = 7) => {
  doc?.setFontSize(7);
  doc?.setFont('helvetica', 'bold');
  doc?.setTextColor(...BRAND?.midGray);
  doc?.text(label, x + 2, y + 4.5);

  doc?.setFont('helvetica', 'normal');
  doc?.setTextColor(...BRAND?.darkGray);
  const displayVal = value === null || value === undefined || value === '' ? '—' : String(value);
  doc?.text(displayVal, x + colW * 0.45, y + 4.5, { maxWidth: colW * 0.52 });
  return y + rowH;
};

// ─── autoTable section helper ─────────────────────────────────────────────────

const renderTable = (doc, startY, margin, pageW, rows) => {
  if (!rows || rows?.length === 0) return startY;
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [['Field', 'Value']],
    body: rows,
    styles: { fontSize: 7.5, cellPadding: [2, 3, 2, 3], overflow: 'linebreak' },
    headStyles: {
      // Nu Dental 2905C (#8DC8E8) table header background with dark navy text
      fillColor: BRAND?.tableHeadBg,
      textColor: BRAND?.tableHeadText,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: BRAND?.offWhite },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: BRAND?.midGray, cellWidth: (pageW - margin * 2) * 0.42 },
      1: { textColor: BRAND?.darkGray },
    },
    didDrawPage: () => {},
  });
  return doc?.lastAutoTable?.finalY + 4;
};

// ─── Main PDF Generator ───────────────────────────────────────────────────────

/**
 * Generate the Nu Dental Insurance Verification PDF.
 * Now async to support logo loading.
 *
 * @param {object} verification - insurance_verifications record
 * @param {object} request      - insurance_verification_requests record
 * @param {object|null} logoResult - pre-loaded logo result { dataURL, nativeDims } (optional)
 * @returns {jsPDF} doc
 */
export function generateInsuranceVerificationPDF(verification, request, logoResult = null) {
  if (!verification) throw new Error('No verification record provided.');
  if (verification?.status !== 'completed') {
    throw new Error('Complete the verification before generating the final PDF.');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc?.internal?.pageSize?.getWidth();
  const pageH = doc?.internal?.pageSize?.getHeight();
  const margin = 15;
  const generatedAt = format(new Date(), 'MM/dd/yyyy h:mm a');

  // Draw header on first page
  drawPageHeader(doc, pageW, margin, generatedAt, logoResult);
  let y = 36;

  // ── Meta info block ──────────────────────────────────────────────────────────
  // Subtle nuMint-tinted background for meta block
  doc?.setFillColor(240, 250, 252);
  doc?.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, 'F');
  doc?.setDrawColor(...BRAND?.nuMint);
  doc?.setLineWidth(0.4);
  doc?.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, 'D');

  const metaColW = (pageW - margin * 2) / 3;
  const metaItems = [
    ['Verification ID', verification?.id?.slice(0, 8) || '—'],
    ['Request ID', request?.id?.slice(0, 8) || '—'],
    ['Completed By', verification?.completed_by_name || verification?.completed_by_email || '—'],
    ['Completed At', fmtDateTime(verification?.completed_at)],
    ['Status', 'Completed'],
    ['Office', verification?.office || request?.office_name || '—'],
  ];

  metaItems?.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const mx = margin + col * metaColW + 3;
    const my = y + 5 + row * 9;
    doc?.setFontSize(6.5);
    doc?.setFont('helvetica', 'bold');
    doc?.setTextColor(...BRAND?.midGray);
    doc?.text(item?.[0], mx, my);
    doc?.setFont('helvetica', 'normal');
    doc?.setTextColor(...BRAND?.darkGray);
    doc?.text(item?.[1], mx, my + 4, { maxWidth: metaColW - 5 });
  });

  y += 26;

  // ── SECTION A: Patient Information ──────────────────────────────────────────
  y = drawSectionBand(doc, 'A. Patient Information', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['Date', fmtDate(verification?.date)],
    ['Patient Name', dash(verification?.patient_name)],
    ['Patient DOB', fmtDate(verification?.patient_dob)],
    ['Subscriber Name', dash(verification?.subscriber_name)],
    ['Subscriber DOB', fmtDate(verification?.subscriber_dob)],
  ]);

  // ── SECTION B: Insurance Information ────────────────────────────────────────
  y = drawSectionBand(doc, 'B. Insurance Information', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['Insurance Name', dash(verification?.insurance_name)],
    ['Insurance Phone', dash(verification?.insurance_phone)],
    ['Claims Address', dash(verification?.claims_address)],
    ['Member ID', dash(verification?.member_id)],
    ['Group Number', dash(verification?.group_number)],
    ['Employer / Group Name', dash(verification?.employer_group_name)],
    ['Payor ID', dash(verification?.payor_id)],
    ['Fee Schedule', dash(verification?.fee_schedule)],
    ['Network', dash(verification?.network)],
    ['OON Available', fmtBool(verification?.oon_available)],
    ['Calendar / Contract Year', dash(verification?.year_type)],
    ['Effective Date', fmtDate(verification?.eff_date)],
    ['Term Date', fmtDate(verification?.term_date)],
  ]);

  // ── SECTION C: Benefits Summary ──────────────────────────────────────────────
  y = drawSectionBand(doc, 'C. Benefits Summary', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['Yearly Max', fmtDollar(verification?.yearly_max)],
    ['Remaining Max', fmtDollar(verification?.remaining_max)],
    ['Max Applies to', fmtCheckboxGroup(verification?.max_applies)],
    ['Deductible', fmtDollar(verification?.deductible)],
    ['Deductible Met', fmtBool(verification?.deductible_met)],
    ['Deductible Applies to', fmtCheckboxGroup(verification?.ded_applies)],
    ['Preventive/Diagnostic %', fmtPct(verification?.pct_prev)],
    ['Basic %', fmtPct(verification?.pct_basic)],
    ['Endo %', fmtPct(verification?.pct_endo)],
    ['Oral Surgery %', fmtPct(verification?.pct_os)],
    ['Perio %', fmtPct(verification?.pct_perio)],
    ['Major %', fmtPct(verification?.pct_major)],
    ['Crowns %', fmtPct(verification?.pct_crowns)],
    ['Bridges %', fmtPct(verification?.pct_bridges)],
    ['Dentures %', fmtPct(verification?.pct_dentures)],
    ['Waiting Period', fmtBool(verification?.waiting_period)],
    ['Missing Tooth Clause', fmtBool(verification?.missing_tooth_clause)],
    ['Dependent Age Limit', dash(verification?.dep_age_limit)],
    ['Student Age Limit', dash(verification?.student_age_limit)],
    ['Can Charge UCR if Not Covered', fmtBool(verification?.ucr_allowed)],
    ['Is Plan Self-Funded', fmtBool(verification?.self_funded)],
    ['Family Deductible', fmtDollar(verification?.family_deductible)],
    ['Family Deductible Met', fmtBool(verification?.family_deductible_met)],
    ['Individual Deductible Remaining', fmtDollar(verification?.individual_deductible_remaining)],
  ]);

  // ── SECTION D: Preventive / Diagnostic ──────────────────────────────────────
  const pd = verification?.prev_diag || {};
  y = drawSectionBand(doc, 'D. Preventive / Diagnostic Coverage', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['Comp Exam D0150 Frequency', dash(pd?.comp_exam_d0150)],
    ['Periodic Exam D0120 Frequency', dash(pd?.periodic_exam_d0120)],
    ['Limited Exam D0140 Frequency', dash(pd?.limited_exam_d0140)],
    ['Shared Frequency', fmtBool(pd?.shared_freq)],
    ['Tx with Limited Exam', fmtBool(pd?.tx_with_limited)],
    ['Prophy D1120/D1110', dash(pd?.prophy)],
    ['BW X-rays D0272/D0274', dash(pd?.bw_d0272_d0274)],
    ['PAs D0220', dash(pd?.pa_d0220)],
    ['FMX/PANO D0210/D0330', dash(pd?.fmx_pano)],
    ['FMX/PANO Shared Frequency', fmtBool(pd?.fmx_pano_shared)],
    ['Eligible for FMX/PANO', fmtBool(pd?.eligible_fmx_pano)],
    ['CT Scan D0383/D0367', dash(pd?.ct_scan)],
    ['Intraoral Images D0350', dash(pd?.intraoral_d0350)],
    ['Sealant D1351', dash(pd?.sealant_d1351)],
    ['Sealant Age Limit', dash(pd?.sealant_age_limit)],
    ['Sealant Covered Teeth', dash(pd?.sealant_covered_teeth)],
    ['Fluoride D1206/D1208', dash(pd?.fluoride)],
    ['Fluoride Age Limit', dash(pd?.fluoride_age_limit)],
  ]);

  // ── SECTION E: Basic / Major Restorative ────────────────────────────────────
  const rs = verification?.restorative || {};
  y = drawSectionBand(doc, 'E. Basic / Major Restorative', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['Posterior Composites D2391-D2394 %', fmtPct(rs?.post_comp_pct)],
    ['Posterior Composites Frequency', dash(rs?.post_comp_freq)],
    ['Posterior Composites Downgraded', fmtBool(rs?.post_comp_downgraded)],
    ['Posterior Composites Downgrade Codes', dash(rs?.post_comp_downgrade_codes)],
    ['Porcelain Crown D2740 %', fmtPct(rs?.porc_crown_pct)],
    ['Porcelain Crown Frequency', dash(rs?.porc_crown_freq)],
    ['Porcelain Crown Downgrade', fmtBool(rs?.porc_crown_downgrade)],
    ['Porcelain Crown Downgrade Code', dash(rs?.porc_crown_downgrade_code)],
    ['Onlay D2643/D2644 %', fmtPct(rs?.onlay_pct)],
    ['Onlay Frequency', dash(rs?.onlay_freq)],
    ['Onlay Downgrade', fmtBool(rs?.onlay_downgrade)],
    ['Onlay Downgrade Code', dash(rs?.onlay_downgrade_code)],
    ['Crowns/Onlays Paid on', dash(rs?.crowns_paid_on)],
    ['Bridges/Dentures %', fmtPct(rs?.bridges_dentures_pct)],
    ['Bridges/Dentures Frequency', dash(rs?.bridges_dentures_freq)],
  ]);

  // ── SECTION F: Periodontics ──────────────────────────────────────────────────
  const perio = verification?.periodontics || {};
  y = drawSectionBand(doc, 'F. Periodontics', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['SRP D4341/D4342 %', fmtPct(perio?.srp_pct)],
    ['SRP Frequency', dash(perio?.srp_freq)],
    ['SRP Quads Allowed', dash(perio?.srp_quads)],
    ['Perio Maintenance D4910 %', fmtPct(perio?.perio_maint_pct)],
    ['Perio Maintenance Frequency', dash(perio?.perio_maint_freq)],
    ['Perio Maint Shared Freq with Prophy', fmtBool(perio?.perio_maint_shared_prophy)],
    ['Healing Period SRP → PMR', dash(perio?.healing_period_srp_pmr)],
    ['Debridement D4355 %', fmtPct(perio?.debridement_pct)],
    ['Debridement Frequency', dash(perio?.debridement_freq)],
    ['Crown Lengthening D4249 %', fmtPct(perio?.crown_lengthening_pct)],
    ['Crown Lengthening Frequency', dash(perio?.crown_lengthening_freq)],
    ['Osseous D4260 %', fmtPct(perio?.osseous_pct)],
    ['Osseous Frequency', dash(perio?.osseous_freq)],
    ['Tissue Graft D4266 %', fmtPct(perio?.tissue_graft_pct)],
    ['Tissue Graft Frequency', dash(perio?.tissue_graft_freq)],
    ['Arestin D4381 %', fmtPct(perio?.arestin_pct)],
    ['Arestin Frequency', dash(perio?.arestin_freq)],
  ]);

  // ── SECTION G: Oral Surgery ──────────────────────────────────────────────────
  const os = verification?.oral_surgery || {};
  y = drawSectionBand(doc, 'G. Oral Surgery', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['OS to Medical as Primary', fmtBool(os?.os_to_medical_primary)],
    ['D7210 %', fmtPct(os?.d7210_pct)],
    ['D7220 %', fmtPct(os?.d7220_pct)],
    ['D7230 %', fmtPct(os?.d7230_pct)],
    ['D7240 %', fmtPct(os?.d7240_pct)],
    ['D7241 %', fmtPct(os?.d7241_pct)],
    ['D7250 %', fmtPct(os?.d7250_pct)],
    ['D7251 %', fmtPct(os?.d7251_pct)],
    ['Bone Graft D7953 %', fmtPct(os?.bone_graft_pct)],
    ['Bone Graft Frequency', dash(os?.bone_graft_freq)],
    ['Bone Graft with Implant D6104 %', fmtPct(os?.bone_graft_implant_pct)],
    ['Bone Graft with Implant Frequency', dash(os?.bone_graft_implant_freq)],
    ['GTR D7956 %', fmtPct(os?.gtr_pct)],
    ['GTR Frequency', dash(os?.gtr_freq)],
    ['GTR with Implant D6106 %', fmtPct(os?.gtr_implant_pct)],
    ['GTR with Implant Frequency', dash(os?.gtr_implant_freq)],
    ['Incision/Drainage Abscess D7510 %', fmtPct(os?.incision_drainage_pct)],
    ['Incision/Drainage Frequency', dash(os?.incision_drainage_freq)],
  ]);

  // ── SECTION H: Implants ──────────────────────────────────────────────────────
  const imp = verification?.implants || {};
  y = drawSectionBand(doc, 'H. Implants', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['Implant Body D6010 %', fmtPct(imp?.implant_body_pct)],
    ['Implant Abutment D6057 %', fmtPct(imp?.implant_abutment_pct)],
    ['Implant Crown D6058 %', fmtPct(imp?.implant_crown_pct)],
    ['Implant Frequency', dash(imp?.implant_freq)],
    ['Implant Downgrade', dash(imp?.implant_downgrade)],
    ['Porcelain/Ceramic Pontic D6245 %', fmtPct(imp?.porc_pontic_pct)],
    ['Abutment Supported Retainer D6068 %', fmtPct(imp?.abutment_retainer_pct)],
    ['Abutment Downgrade', dash(imp?.abutment_downgrade)],
  ]);

  // ── SECTION I: Ortho ────────────────────────────────────────────────────────
  const orth = verification?.ortho || {};
  y = drawSectionBand(doc, 'I. Ortho', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['Ortho D8090 %', fmtPct(orth?.ortho_pct)],
    ['Ortho Max', fmtDollar(orth?.ortho_max)],
    ['Ortho Age Limit', dash(orth?.ortho_age_limit)],
    ['Ortho Deductible', fmtBool(orth?.ortho_deductible)],
  ]);

  // ── SECTION J: Misc / Rep / Ref # / Employee Initials / Notes ───────────────
  const misc = verification?.misc || {};
  const hist = verification?.history || {};
  y = drawSectionBand(doc, 'J. Misc / Rep / Ref # / Employee Initials / Notes', y, margin, pageW);
  y = renderTable(doc, y, margin, pageW, [
    ['Consult D9310 %', fmtPct(misc?.consult_pct)],
    ['Consult Frequency', dash(misc?.consult_freq)],
    ['Nitrous D9230 %', fmtPct(misc?.nitrous_pct)],
    ['Nitrous Frequency', dash(misc?.nitrous_freq)],
    ['Nightguard D9944 %', fmtPct(misc?.nightguard_pct)],
    ['Nightguard Frequency', dash(misc?.nightguard_freq)],
    ['Bruxism or Osseous', dash(misc?.bruxism_or_osseous)],
    ['History', fmtBool(hist?.has_history)],
    ['History Notes', dash(hist?.history_notes)],
    ['Rep', dash(verification?.rep_name)],
    ['Ref #', dash(verification?.ref_number)],
    ['Employee Initials', dash(verification?.employee_initials)],
    ['Notes', dash(verification?.notes)],
  ]);

  // ── Paginate footers ─────────────────────────────────────────────────────────
  const totalPages = doc?.internal?.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc?.setPage(i);
    // Re-draw header on pages > 1
    if (i > 1) {
      drawPageHeader(doc, pageW, margin, generatedAt, logoResult);
    }
    drawPageFooter(doc, pageW, pageH, margin, i, totalPages);
  }

  return doc;
}

// ─── Browser Download ─────────────────────────────────────────────────────────

/**
 * Trigger browser download of the PDF.
 * @param {jsPDF} doc
 * @param {string} filename
 */
export function downloadPDF(doc, filename) {
  doc?.save(filename);
}

// ─── Storage Upload ───────────────────────────────────────────────────────────

/**
 * Upload PDF to Supabase private storage bucket 'insurance-verifications'.
 * Returns { storagePath, checksum } on success, or throws with descriptive error.
 *
 * @param {jsPDF} doc
 * @param {string} storagePath
 * @returns {{ storagePath: string, checksum: string|null }}
 */
export async function uploadPDFToStorage(doc, storagePath) {
  const pdfArrayBuffer = doc?.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

  // Compute checksum before upload
  const checksum = await computeSHA256(pdfArrayBuffer);

  const { error } = await supabase?.storage
    ?.from('insurance-verifications')
    ?.upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error?.message}`);
  }

  return { storagePath, checksum };
}

// ─── Update PDF Metadata ──────────────────────────────────────────────────────

/**
 * Update insurance_verifications PDF metadata columns.
 * Columns: pdf_storage_path, pdf_generated_at, pdf_checksum_sha256
 *
 * @param {string} verificationId
 * @param {string} storagePath
 * @param {string|null} checksum
 * @returns {object} updated record
 */
export async function updatePDFMetadata(verificationId, storagePath, checksum) {
  const now = new Date()?.toISOString();
  const { data, error } = await supabase
    ?.from('insurance_verifications')
    ?.update({
      pdf_storage_path: storagePath,
      pdf_generated_at: now,
      pdf_checksum_sha256: checksum || null,
      updated_at: now,
    })
    ?.eq('id', verificationId)
    ?.select('id, pdf_storage_path, pdf_generated_at, pdf_checksum_sha256')
    ?.single();

  if (error) {
    throw new Error(`PDF metadata update failed: ${error?.message}`);
  }
  return data;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Full PDF generation + download + optional storage flow.
 * V504A: Loads Nu Dental logo before generating PDF.
 * V504B: Always regenerates fresh PDF on every click — never serves cached/old version.
 *        Always overwrites storage (upsert:true) and always updates pdf_generated_at /
 *        pdf_checksum_sha256 regardless of storage outcome.
 *
 * Steps:
 * 1. Validate verification is completed.
 * 2. Load Nu Dental logo (non-fatal if unavailable).
 * 3. Generate PDF fresh using current branded template.
 * 4. Compute SHA-256 checksum from fresh PDF bytes.
 * 5. Trigger browser download immediately (user gets the file regardless of storage outcome).
 * 6. Attempt storage upload to 'insurance-verifications' bucket (upsert — overwrites existing).
 * 7. Always update pdf_generated_at and pdf_checksum_sha256 (storage path only if upload succeeded).
 * 8. Insert audit log events: pdf_generated, pdf_downloaded.
 * 9. Return result summary.
 *
 * @param {object} verification - insurance_verifications record
 * @param {object} request      - insurance_verification_requests record
 * @param {object} userProfile  - current user profile
 * @returns {{ filename, storageResult, metadataResult, auditResult }}
 */
export async function generateAndDownloadInsurancePDF(verification, request, userProfile) {
  // Guard: only for completed verifications
  if (!verification) {
    throw new Error('No verification record provided.');
  }
  if (verification?.status !== 'completed') {
    throw new Error('Complete the verification before generating the final PDF.');
  }

  const filename = buildInsurancePDFFilename(verification, request);
  const storagePath = buildStoragePath(verification, request);

  // Step 1: Load Nu Dental logo (non-fatal)
  let logoResult = null;
  try {
    logoResult = await loadLogoDataURL();
  } catch {
    console.warn('[insuranceVerificationPDFService] Logo load failed (non-fatal) — PDF will render without logo image.');
  }

  // Step 2: Generate PDF fresh from current branded template (never cached)
  const doc = generateInsuranceVerificationPDF(verification, request, logoResult);

  // Step 3: Compute checksum from fresh PDF bytes (before download/upload)
  let freshChecksum = null;
  try {
    const pdfArrayBuffer = doc?.output('arraybuffer');
    freshChecksum = await computeSHA256(pdfArrayBuffer);
  } catch {
    console.warn('[insuranceVerificationPDFService] Checksum computation failed (non-fatal).');
  }

  // Step 4: Browser download (immediate — user gets the fresh branded PDF regardless of storage)
  downloadPDF(doc, filename);

  const result = {
    filename,
    storageResult: null,
    storageError: null,
    metadataResult: null,
    metadataError: null,
    auditResult: null,
    auditError: null,
  };

  // Step 5: Attempt storage upload (upsert:true — always overwrites any existing stored PDF)
  let uploadedStoragePath = null;
  try {
    const { storagePath: up, checksum } = await uploadPDFToStorage(doc, storagePath);
    uploadedStoragePath = up;
    result.storageResult = { storagePath: up, checksum };
  } catch (storageErr) {
    result.storageError = storageErr?.message;
    console.warn('[insuranceVerificationPDFService] Storage upload failed (non-fatal, browser download already completed):', storageErr?.message);
  }

  // Step 6: Always update pdf_generated_at and pdf_checksum_sha256 with fresh values.
  // If storage succeeded, also update pdf_storage_path.
  // This ensures the metadata always reflects the latest branded PDF generation,
  // even when storage upload fails (browser-download-only path).
  try {
    const now = new Date()?.toISOString();
    const metaUpdate = {
      pdf_generated_at: now,
      pdf_checksum_sha256: freshChecksum || null,
      updated_at: now,
    };
    if (uploadedStoragePath) {
      metaUpdate.pdf_storage_path = uploadedStoragePath;
    }

    const { data, error } = await supabase
      ?.from('insurance_verifications')
      ?.update(metaUpdate)
      ?.eq('id', verification?.id)
      ?.select('id, pdf_storage_path, pdf_generated_at, pdf_checksum_sha256')
      ?.single();

    if (error) {
      result.metadataError = error?.message;
      console.warn('[insuranceVerificationPDFService] PDF metadata update failed (non-fatal):', error?.message);
    } else {
      result.metadataResult = data;
    }
  } catch (metaErr) {
    result.metadataError = metaErr?.message;
    console.warn('[insuranceVerificationPDFService] PDF metadata update failed (non-fatal):', metaErr?.message);
  }

  // Step 7: Audit log — pdf_generated
  try {
    await insertAuditLog({
      requestId: verification?.request_id || request?.id,
      verificationId: verification?.id,
      eventType: 'pdf_generated',
      performedByUserId: userProfile?.id,
      performedByEmail: userProfile?.email,
      performedByName: userProfile?.full_name,
      metadata: {
        filename,
        storage_path: uploadedStoragePath || null,
        storage_success: !!uploadedStoragePath,
        storage_error: result?.storageError || null,
      },
    });

    // Step 8: Audit log — pdf_downloaded
    await insertAuditLog({
      requestId: verification?.request_id || request?.id,
      verificationId: verification?.id,
      eventType: 'pdf_downloaded',
      performedByUserId: userProfile?.id,
      performedByEmail: userProfile?.email,
      performedByName: userProfile?.full_name,
      metadata: { filename },
    });

    result.auditResult = 'pdf_generated + pdf_downloaded logged';
  } catch (auditErr) {
    result.auditError = auditErr?.message;
    console.warn('[insuranceVerificationPDFService] Audit log insert failed (non-fatal):', auditErr?.message);
  }

  return result;
}

// ─── Phase 4B: Update Office Email Metadata ───────────────────────────────────

/**
 * Update office email metadata on insurance_verifications after a successful send.
 * Columns updated: office_emailed_at, office_email_to
 *
 * @param {string} verificationId
 * @param {string} emailedTo - recipient email address
 * @returns {object|null}
 */
export async function updateOfficeEmailMetadata(verificationId, emailedTo) {
  const now = new Date()?.toISOString();
  try {
    const { data, error } = await supabase
      ?.from('insurance_verifications')
      ?.update({
        office_emailed_at: now,
        office_email_to: emailedTo,
        updated_at: now,
      })
      ?.eq('id', verificationId)
      ?.select('id, office_emailed_at, office_email_to')
      ?.single();
    if (error) {
      console.warn('[insuranceVerificationPDFService] office email metadata update failed (non-fatal):', error?.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[insuranceVerificationPDFService] office email metadata update threw (non-fatal):', err?.message);
    return null;
  }
}

/**
 * Update office_emailed_at on insurance_verification_requests after a successful send.
 * Column: office_emailed_at
 *
 * @param {string} requestId
 * @returns {void}
 */
export async function updateRequestOfficeEmailedAt(requestId) {
  const now = new Date()?.toISOString();
  try {
    const { error } = await supabase
      ?.from('insurance_verification_requests')
      ?.update({ office_emailed_at: now, updated_at: now })
      ?.eq('id', requestId);
    if (error) {
      console.warn('[insuranceVerificationPDFService] request office_emailed_at update failed (non-fatal):', error?.message);
    }
  } catch (err) {
    console.warn('[insuranceVerificationPDFService] request office_emailed_at update threw (non-fatal):', err?.message);
  }
}

// ─── Phase 4B: Email PDF to Office ───────────────────────────────────────────

/**
 * Generate the branded PDF, convert to base64, and email it to the office via
 * the existing send-email edge function (Resend API with attachments support).
 *
 * Steps:
 * 1. Validate verification is completed.
 * 2. Validate recipient email is present.
 * 3. Load Nu Dental logo (non-fatal).
 * 4. Generate PDF fresh from current branded template.
 * 5. Convert PDF to base64 string for Resend attachments.
 * 6. Invoke send-email edge function with email_type = insurance_verification_pdf
 *    and attachments = [{ content: base64, filename }].
 * 7. On success: update office_emailed_at, office_email_to on insurance_verifications.
 *               update office_emailed_at on insurance_verification_requests.
 *               insert audit log: office_email_sent.
 * 8. On failure: do NOT update metadata. Insert audit log: office_email_failed.
 *               throw error so caller can show it to user.
 *
 * @param {object} verification - insurance_verifications record
 * @param {object} request      - insurance_verification_requests record
 * @param {string} recipientEmail - validated office email address
 * @param {object} userProfile  - current user profile
 * @returns {{ success: true, emailId, filename, recipient }}
 */
export async function emailInsurancePDFToOffice(verification, request, recipientEmail, userProfile) {
  // Guard: only for completed verifications
  if (!verification) {
    throw new Error('No verification record provided.');
  }
  if (verification?.status !== 'completed') {
    throw new Error('Only completed verifications can be emailed to the office.');
  }
  if (!recipientEmail?.trim()) {
    throw new Error('Recipient email address is required.');
  }

  const filename = buildInsurancePDFFilename(verification, request);
  const patientName = verification?.patient_name || request?.patient_name ||
    [request?.patient_first_name, request?.patient_last_name]?.filter(Boolean)?.join(' ') || 'Unknown Patient';
  const officeName = verification?.office || request?.office_name || '—';
  const insuranceCompany = verification?.insurance_name || request?.insurance_company_name || '—';

  // Step 1: Load Nu Dental logo (non-fatal)
  let logoResult = null;
  try {
    logoResult = await loadLogoDataURL();
  } catch {
    console.warn('[insuranceVerificationPDFService] Logo load failed (non-fatal) — PDF will render without logo image.');
  }

  // Step 2: Generate PDF fresh from current branded template
  const doc = generateInsuranceVerificationPDF(verification, request, logoResult);

  // Step 3: Convert PDF to base64 for Resend attachment
  const pdfArrayBuffer = doc?.output('arraybuffer');
  const pdfUint8 = new Uint8Array(pdfArrayBuffer);

  // Convert Uint8Array to base64 string (browser-compatible)
  let base64PDF = '';
  try {
    const binaryString = Array.from(pdfUint8)?.map((b) => String.fromCharCode(b))?.join('');
    base64PDF = btoa(binaryString);
  } catch (encErr) {
    throw new Error(`Failed to encode PDF for email attachment: ${encErr?.message}`);
  }

  // Step 4: Build email data
  const completedAtFormatted = verification?.completed_at
    ? (() => { try { return format(parseISO(verification?.completed_at), 'MM/dd/yyyy h:mm a'); } catch { return verification?.completed_at; } })()
    : '—';

  const patientDobFormatted = (verification?.patient_dob || request?.patient_dob)
    ? (() => {
        const dob = verification?.patient_dob || request?.patient_dob;
        try {
          const d = dob?.includes('T') ? parseISO(dob) : new Date(dob + 'T12:00:00');
          return format(d, 'MM/dd/yyyy');
        } catch { return dob; }
      })()
    : null;

  const emailSubject = `Completed Insurance Verification Form — ${patientName} — ${officeName}`;

  const emailData = {
    subject: emailSubject,
    patient_name: patientName,
    patient_dob: patientDobFormatted,
    insurance_company: insuranceCompany,
    office_name: officeName,
    completed_by: verification?.completed_by_name || verification?.completed_by_email || '—',
    completed_at: completedAtFormatted,
    pdf_filename: filename,
  };

  const attachments = [
    {
      content: base64PDF,
      filename,
    },
  ];

  // Step 5: Invoke send-email edge function
  let emailResult = null;
  try {
    const { data: result, error } = await supabase?.functions?.invoke('send-email', {
      body: {
        email_type: 'insurance_verification_pdf',
        recipient_email: recipientEmail?.trim(),
        recipient_name: officeName,
        data: emailData,
        attachments,
      },
    });
    if (error) throw error;
    if (!result?.success) throw new Error(result?.error || 'Email send failed');
    emailResult = result;
  } catch (sendErr) {
    // Email failed — insert audit log (non-fatal) then re-throw
    try {
      await insertAuditLog({
        requestId: verification?.request_id || request?.id,
        verificationId: verification?.id,
        eventType: 'office_email_failed',
        performedByUserId: userProfile?.id,
        performedByEmail: userProfile?.email,
        performedByName: userProfile?.full_name,
        metadata: {
          recipient: recipientEmail,
          filename,
          error: sendErr?.message,
        },
      });
    } catch {
      // audit insert failure is non-fatal
    }
    throw new Error(`Email send failed: ${sendErr?.message}`);
  }

  // Step 6: Email succeeded — update metadata (non-fatal)
  await updateOfficeEmailMetadata(verification?.id, recipientEmail?.trim());
  await updateRequestOfficeEmailedAt(verification?.request_id || request?.id);

  // Step 7: Audit log — office_email_sent (non-fatal)
  try {
    await insertAuditLog({
      requestId: verification?.request_id || request?.id,
      verificationId: verification?.id,
      eventType: 'office_email_sent',
      performedByUserId: userProfile?.id,
      performedByEmail: userProfile?.email,
      performedByName: userProfile?.full_name,
      metadata: {
        recipient: recipientEmail,
        filename,
        email_id: emailResult?.id || null,
      },
    });
  } catch {
    // audit insert failure is non-fatal
  }

  return {
    success: true,
    emailId: emailResult?.id || null,
    filename,
    recipient: recipientEmail?.trim(),
  };
}
