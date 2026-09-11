/**
 * providerPayrollPDFService.js
 * Generates a professional provider payroll PDF report using jsPDF + autoTable.
 * Uses actual Dentrix Ascend collection data — no gross production, no Gusto.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Office normalization ─────────────────────────────────────────────────────
const OFFICE_DISPLAY_MAP = {
  'nu dental of brick': 'Brick',
  'nu dental of barnegat': 'Barnegat',
  'nu dental of eatontown': 'Eatontown',
  'nu dental of staten island': 'Staten Island',
  brick: 'Brick',
  barnegat: 'Barnegat',
  eatontown: 'Eatontown',
  'staten island': 'Staten Island',
};

export function normalizeOfficeForPDF(raw) {
  if (!raw) return 'Unknown Office';
  const key = raw?.toString()?.toLowerCase()?.trim();
  return OFFICE_DISPLAY_MAP?.[key] || raw;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtCurrency(v) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })?.format(parseFloat(v) || 0);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateISO(dateStr) {
  if (!dateStr) return '';
  return dateStr?.slice(0, 10);
}

// ─── PDF filename ─────────────────────────────────────────────────────────────
export function buildPDFFilename(providerName, periodStart, periodEnd) {
  const safeName = (providerName || 'Provider')?.replace(/\s+/g, '_')?.replace(/[^a-zA-Z0-9_.-]/g, '');
  const start = fmtDateISO(periodStart);
  const end = fmtDateISO(periodEnd);
  return `${safeName}_PayrollReport_${start}_to_${end}.pdf`;
}

// ─── Color palette ────────────────────────────────────────────────────────────
const BRAND_TEAL = [0, 181, 204];
const DARK_GRAY = [31, 41, 55];
const MID_GRAY = [107, 114, 128];
const LIGHT_GRAY = [243, 244, 246];
const WHITE = [255, 255, 255];
const WARN_AMBER = [217, 119, 6];
const SUCCESS_GREEN = [5, 150, 105];
const ERROR_RED = [220, 38, 38];

/**
 * Main PDF generator.
 *
 * @param {object} params
 * @param {string} params.providerName
 * @param {string} params.providerType  - 'doctor' | 'hygienist'
 * @param {string} params.officeName    - canonical office name or 'All Offices'
 * @param {string} params.periodStart   - YYYY-MM-DD
 * @param {string} params.periodEnd     - YYYY-MM-DD
 * @param {number} params.selectedPct   - e.g. 0.32, 0.33, 0.34, 0.35, 0.40, 0.45
 * @param {number} params.totalCollections
 * @param {number} params.compensationAmount
 * @param {number|null} params.mtdCollections
 * @param {string|null} params.suggestedTierLabel  - e.g. "34% (MTD $72,000)"
 * @param {Array}  params.detailRows    - transaction-level rows
 * @param {object} params.reconciliation - { matches: bool, difference: number, dashboardTotal: number, reportTotal: number }
 * @param {Array}  params.officeSubtotals - [{ officeName, collections }]
 * @param {string} params.generatedDate
 * @returns {jsPDF} doc
 */
export function generateProviderPayrollPDF({
  providerName,
  providerType,
  officeName,
  periodStart,
  periodEnd,
  selectedPct,
  totalCollections,
  compensationAmount,
  mtdCollections,
  suggestedTierLabel,
  detailRows = [],
  reconciliation = null,
  officeSubtotals = [],
  generatedDate,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc?.internal?.pageSize?.getWidth();
  const pageH = doc?.internal?.pageSize?.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Header band ────────────────────────────────────────────────────────────
  doc?.setFillColor(...BRAND_TEAL);
  doc?.rect(0, 0, pageW, 28, 'F');

  doc?.setTextColor(...WHITE);
  doc?.setFontSize(16);
  doc?.setFont('helvetica', 'bold');
  doc?.text('NU DENTAL', margin, 11);

  doc?.setFontSize(9);
  doc?.setFont('helvetica', 'normal');
  doc?.text('Provider Compensation Report', margin, 17);
  doc?.text('Confidential — For Internal Use Only', margin, 22);

  // Right side of header
  doc?.setFontSize(8);
  doc?.text(`Generated: ${generatedDate || fmtDate(new Date()?.toISOString()?.slice(0, 10))}`, pageW - margin, 11, { align: 'right' });
  doc?.text('nudashboard.com', pageW - margin, 17, { align: 'right' });

  y = 35;

  // ── Provider info block ────────────────────────────────────────────────────
  doc?.setFillColor(...LIGHT_GRAY);
  doc?.roundedRect(margin, y, contentW, 32, 2, 2, 'F');

  doc?.setTextColor(...DARK_GRAY);
  doc?.setFontSize(13);
  doc?.setFont('helvetica', 'bold');
  doc?.text(providerName || 'Unknown Provider', margin + 4, y + 8);

  doc?.setFontSize(9);
  doc?.setFont('helvetica', 'normal');
  doc?.setTextColor(...MID_GRAY);
  const typeLabel = providerType === 'doctor' ? 'Doctor' : 'Hygienist';
  doc?.text(`Provider Type: ${typeLabel}`, margin + 4, y + 15);
  doc?.text(`Office(s): ${normalizeOfficeForPDF(officeName) || 'All Offices'}`, margin + 4, y + 21);
  doc?.text(`Pay Period: ${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`, margin + 4, y + 27);

  // Right column
  const col2x = margin + contentW / 2;
  doc?.setTextColor(...DARK_GRAY);
  doc?.setFontSize(9);
  doc?.text(`Compensation %: ${(selectedPct * 100)?.toFixed(0)}%`, col2x, y + 15);
  if (mtdCollections != null) {
    doc?.text(`MTD Collections: ${fmtCurrency(mtdCollections)}`, col2x, y + 21);
  }
  if (suggestedTierLabel) {
    doc?.text(`Suggested Tier: ${suggestedTierLabel}`, col2x, y + 27);
  }

  y += 38;

  // ── Summary totals ─────────────────────────────────────────────────────────
  const boxW = (contentW - 6) / 3;

  // Box 1: Total Collections
  doc?.setFillColor(...BRAND_TEAL);
  doc?.roundedRect(margin, y, boxW, 18, 2, 2, 'F');
  doc?.setTextColor(...WHITE);
  doc?.setFontSize(7);
  doc?.setFont('helvetica', 'bold');
  doc?.text('TOTAL COLLECTIONS', margin + 3, y + 6);
  doc?.setFontSize(11);
  doc?.text(fmtCurrency(totalCollections), margin + 3, y + 14);

  // Box 2: Compensation %
  doc?.setFillColor(99, 102, 241); // indigo
  doc?.roundedRect(margin + boxW + 3, y, boxW, 18, 2, 2, 'F');
  doc?.setTextColor(...WHITE);
  doc?.setFontSize(7);
  doc?.setFont('helvetica', 'bold');
  doc?.text('COMPENSATION RATE', margin + boxW + 6, y + 6);
  doc?.setFontSize(11);
  doc?.text(`${(selectedPct * 100)?.toFixed(0)}%`, margin + boxW + 6, y + 14);

  // Box 3: Estimated Compensation
  doc?.setFillColor(5, 150, 105); // emerald
  doc?.roundedRect(margin + (boxW + 3) * 2, y, boxW, 18, 2, 2, 'F');
  doc?.setTextColor(...WHITE);
  doc?.setFontSize(7);
  doc?.setFont('helvetica', 'bold');
  doc?.text('ESTIMATED COMPENSATION', margin + (boxW + 3) * 2 + 3, y + 6);
  doc?.setFontSize(11);
  doc?.text(fmtCurrency(compensationAmount), margin + (boxW + 3) * 2 + 3, y + 14);

  y += 24;

  // ── Reconciliation warning ─────────────────────────────────────────────────
  if (reconciliation && !reconciliation?.matches) {
    doc?.setFillColor(254, 243, 199); // amber-100
    doc?.roundedRect(margin, y, contentW, 14, 2, 2, 'F');
    doc?.setTextColor(...WARN_AMBER);
    doc?.setFontSize(8);
    doc?.setFont('helvetica', 'bold');
    doc?.text('⚠ RECONCILIATION WARNING', margin + 3, y + 6);
    doc?.setFont('helvetica', 'normal');
    doc?.setFontSize(7.5);
    doc?.text(
      `Report detail does not reconcile to payroll provider total. Difference: ${fmtCurrency(Math.abs(reconciliation?.difference))}. Please review source mapping.`,
      margin + 3,
      y + 11
    );
    y += 18;
  }

  // ── Office subtotals (multi-office) ───────────────────────────────────────
  if (officeSubtotals && officeSubtotals?.length > 1) {
    doc?.setTextColor(...DARK_GRAY);
    doc?.setFontSize(9);
    doc?.setFont('helvetica', 'bold');
    doc?.text('Collections by Office', margin, y + 5);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Office', 'Collections']],
      body: officeSubtotals?.map(o => [
        normalizeOfficeForPDF(o?.officeName),
        fmtCurrency(o?.collections),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BRAND_TEAL, textColor: WHITE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 1: { halign: 'right' } },
    });
    y = doc?.lastAutoTable?.finalY + 6;
  }

  // ── Detail table ───────────────────────────────────────────────────────────
  doc?.setTextColor(...DARK_GRAY);
  doc?.setFontSize(9);
  doc?.setFont('helvetica', 'bold');
  doc?.text('Collection Detail', margin, y + 5);
  y += 8;

  const hasDetailRows = detailRows && detailRows?.length > 0;

  if (hasDetailRows) {
    const tableHead = [
      'Date',
      'Office',
      'Patient',
      'Payment Type',
      'Procedure',
      'Gross Prod.',
      'Adjustment',
      'Net Prod.',
      'Collection',
    ];

    const tableBody = detailRows?.map(row => [
      fmtDate(row?.collectionDate || row?.date || row?.posted_date || row?.service_date),
      normalizeOfficeForPDF(row?.officeName || row?.office_name || row?.location_name),
      row?.patientName || row?.patient_name || row?.patient_identifier || '—',
      row?.paymentType || row?.payment_type || row?.payment_source || '—',
      row?.procedureCode
        ? `${row?.procedureCode}${row?.procedureDescription ? ' – ' + row?.procedureDescription?.slice(0, 20) : ''}`
        : (row?.procedure_description || '—'),
      row?.grossProduction != null ? fmtCurrency(row?.grossProduction) : '—',
      row?.adjustmentAmount != null ? fmtCurrency(row?.adjustmentAmount) : '—',
      row?.netProduction != null ? fmtCurrency(row?.netProduction) : '—',
      fmtCurrency(row?.collectionAmount || row?.collection_amount || row?.amount || 0),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [tableHead],
      body: tableBody,
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: DARK_GRAY, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
        2: { cellWidth: 28 },
        3: { cellWidth: 22 },
        4: { cellWidth: 30 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 18 },
        7: { halign: 'right', cellWidth: 18 },
        8: { halign: 'right', cellWidth: 18, fontStyle: 'bold' },
      },
      didDrawPage: (data) => {
        // Footer on each page
        doc?.setFontSize(7);
        doc?.setTextColor(...MID_GRAY);
        doc?.text(
          `Nu Dental — ${providerName} — Pay Period ${fmtDate(periodStart)} to ${fmtDate(periodEnd)} — Page ${data?.pageNumber}`,
          pageW / 2,
          pageH - 8,
          { align: 'center' }
        );
      },
    });

    y = doc?.lastAutoTable?.finalY + 6;
  } else {
    doc?.setFillColor(...LIGHT_GRAY);
    doc?.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
    doc?.setTextColor(...MID_GRAY);
    doc?.setFontSize(8);
    doc?.setFont('helvetica', 'italic');
    doc?.text(
      'Transaction-level detail rows not available. Report total is based on provider-level collection summary from Dentrix Ascend.',
      margin + 3,
      y + 7
    );
    y += 16;
  }

  // ── Summary footer ─────────────────────────────────────────────────────────
  // Ensure we have space; add page if needed
  if (y > pageH - 55) {
    doc?.addPage();
    y = margin;
  }

  doc?.setFillColor(...LIGHT_GRAY);
  doc?.roundedRect(margin, y, contentW, 38, 2, 2, 'F');

  doc?.setTextColor(...DARK_GRAY);
  doc?.setFontSize(9);
  doc?.setFont('helvetica', 'bold');
  doc?.text('Report Summary', margin + 4, y + 7);

  doc?.setFontSize(8.5);
  doc?.setFont('helvetica', 'normal');

  const summaryLines = [
    ['Total Collections (Pay Period):', fmtCurrency(totalCollections)],
    ['Compensation Rate:', `${(selectedPct * 100)?.toFixed(0)}%`],
    ['Estimated Compensation:', fmtCurrency(compensationAmount)],
  ];

  if (mtdCollections != null) {
    summaryLines?.push(['Month-to-Date Collections:', fmtCurrency(mtdCollections)]);
  }

  summaryLines?.forEach(([label, value], i) => {
    const lineY = y + 14 + i * 6;
    doc?.setTextColor(...MID_GRAY);
    doc?.text(label, margin + 4, lineY);
    doc?.setTextColor(...DARK_GRAY);
    doc?.setFont('helvetica', 'bold');
    doc?.text(value, pageW - margin - 4, lineY, { align: 'right' });
    doc?.setFont('helvetica', 'normal');
  });

  y += 42;

  // ── Reconciliation status ──────────────────────────────────────────────────
  if (reconciliation) {
    const recColor = reconciliation?.matches ? SUCCESS_GREEN : WARN_AMBER;
    doc?.setFillColor(...recColor);
    doc?.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
    doc?.setTextColor(...WHITE);
    doc?.setFontSize(8);
    doc?.setFont('helvetica', 'bold');
    const recText = reconciliation?.matches
      ? `✓ Reconciled — Report total matches dashboard total: ${fmtCurrency(reconciliation?.reportTotal)}`
      : `⚠ Needs Review — Difference: ${fmtCurrency(Math.abs(reconciliation?.difference))} (Dashboard: ${fmtCurrency(reconciliation?.dashboardTotal)} vs Report: ${fmtCurrency(reconciliation?.reportTotal)})`;
    doc?.text(recText, margin + 3, y + 6.5);
    y += 14;
  }

  // ── Final footer ───────────────────────────────────────────────────────────
  doc?.setFontSize(7);
  doc?.setTextColor(...MID_GRAY);
  doc?.setFont('helvetica', 'italic');
  doc?.text(
    'Source: Dentrix Ascend via FastAPI (ascendApi.getProductionByProvider). No Gusto data. No proration. Confidential.',
    pageW / 2,
    pageH - 8,
    { align: 'center' }
  );

  return doc;
}

/**
 * Generates the PDF and returns it as a base64 string (for email attachment).
 */
export function generatePDFBase64(params) {
  const doc = generateProviderPayrollPDF(params);
  return doc?.output('datauristring')?.split(',')?.[1]; // base64 only
}

/**
 * Triggers browser download of the PDF.
 */
export function downloadProviderPayrollPDF(params) {
  const doc = generateProviderPayrollPDF(params);
  const filename = buildPDFFilename(params?.providerName, params?.periodStart, params?.periodEnd);
  doc?.save(filename);
}
