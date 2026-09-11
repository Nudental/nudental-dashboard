import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

const BRAND = {
  slate: '#1e293b',
  indigo: '#4f46e5',
  indigoLight: '#e0e7ff',
  emerald: '#059669',
  muted: '#64748b',
  border: '#e2e8f0',
  white: '#ffffff',
  bg: '#f8fafc',
};

const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v || 0);

const fmtPct = (v) => (v === null || v === undefined ? 'N/A' : `${v >= 0 ? '+' : ''}${v}%`);

/**
 * Capture a DOM element as a base64 PNG image
 */
export const captureElement = async (elementId) => {
  const el = document.getElementById(elementId);
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    return canvas?.toDataURL('image/png');
  } catch (err) {
    console.warn('html2canvas capture failed:', err);
    return null;
  }
};

/**
 * Draw a horizontal rule
 */
const drawHR = (doc, y, margin, pageWidth) => {
  doc?.setDrawColor(BRAND?.border);
  doc?.setLineWidth(0.3);
  doc?.line(margin, y, pageWidth - margin, y);
};

/**
 * Draw a section header bar
 */
const drawSectionHeader = (doc, text, y, margin, pageWidth) => {
  doc?.setFillColor(BRAND?.slate);
  doc?.rect(margin, y, pageWidth - margin * 2, 8, 'F');
  doc?.setTextColor(BRAND?.white);
  doc?.setFontSize(8);
  doc?.setFont('helvetica', 'bold');
  doc?.text(text?.toUpperCase(), margin + 4, y + 5.5);
  doc?.setTextColor(BRAND?.slate);
  return y + 8;
};

/**
 * Draw footer on current page
 */
const drawFooter = (doc, pageWidth, pageHeight, margin, dateGenerated) => {
  const footerY = pageHeight - 10;
  doc?.setDrawColor(BRAND?.border);
  doc?.setLineWidth(0.3);
  doc?.line(margin, footerY - 2, pageWidth - margin, footerY - 2);
  doc?.setFontSize(7);
  doc?.setFont('helvetica', 'normal');
  doc?.setTextColor(BRAND?.muted);
  doc?.text(
    `NuDental Confidential Management Report — Generated ${dateGenerated}`,
    pageWidth / 2,
    footerY + 2,
    { align: 'center' }
  );
};

/**
 * Main PDF generator
 *
 * SOURCE-OF-TRUTH RULES (CRITICAL):
 *   - netProduction  → Dentrix Ascend /v2/production/summary (dentrixData.netProduction)
 *   - totalCollections → Dentrix Ascend /v2/collections/summary (dentrixData.totalCollections)
 *   - collectionRate → actual collections ÷ net production (NOT from daily_entries)
 *   - officeBreakdown → per-office Dentrix data (dentrixData.officeBreakdown)
 *   - daily_entries / EOD data → NOT used for any financial totals in this PDF
 *
 * @param {object} params
 * @param {object} params.dentrixData     - Dentrix KPI payload from useExecutiveOverview / overviewData
 *   Shape: {
 *     netProduction: number,
 *     totalCollections: number,
 *     collectionRate: number|null,
 *     newPatients: number,
 *     officeBreakdown: Array<{
 *       id: string, name: string,
 *       netProduction: number, totalCollections: number,
 *       collectionRate: number|null, newPatients: number
 *     }>,
 *     startDate: string, endDate: string,
 *   }
 * @param {object} params.growthData      - result from fetchMonthlyGrowth() (for growth analysis section)
 * @param {number} params.month           - 1-12 (for label only)
 * @param {number} params.year            - e.g. 2026 (for label only)
 * @param {string} params.periodLabel     - human-readable period label (e.g. "April 2026")
 * @param {string|null} params.chartImageData - base64 PNG of the bar chart element
 * @returns {jsPDF} doc
 */
export const generateExecutivePDF = async ({
  dentrixData,
  growthData,
  // Legacy params kept for backward compat but no longer used for financial data
  kpiData,
  month,
  year,
  periodLabel,
  chartImageData = null,
}) => {
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // Resolve period label: prefer explicit periodLabel, then dentrixData metadata, then month/year
  const resolvedPeriodLabel =
    periodLabel ||
    (dentrixData?.startDate && dentrixData?.endDate
      ? (() => {
          const start = new Date(dentrixData.startDate + 'T00:00:00');
          const end = new Date(dentrixData.endDate + 'T00:00:00');
          const startLabel = `${MONTH_NAMES?.[start?.getMonth()]} ${start?.getFullYear()}`;
          const endLabel = `${MONTH_NAMES?.[end?.getMonth()]} ${end?.getFullYear()}`;
          return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
        })()
      : `${MONTH_NAMES?.[month - 1]} ${year}`);

  const dateGenerated = format(new Date(), 'MMMM d, yyyy h:mm a');

  // ── Resolve Dentrix financial values ─────────────────────────────────────
  // SOURCE: Dentrix Ascend API via useExecutiveOverview hook
  // NEVER use kpiData.groupTotals (daily_entries EOD) for these values.
  const dentrixNetProduction = Math.abs(parseFloat(dentrixData?.netProduction ?? 0));
  const dentrixTotalCollections = Math.abs(parseFloat(dentrixData?.totalCollections ?? 0));
  const dentrixNewPatients = parseInt(dentrixData?.newPatients ?? 0, 10);

  // Collection % = actual collections ÷ net production (Dentrix values only)
  const dentrixCollectionRate =
    dentrixData?.collectionRate != null
      ? parseFloat(dentrixData?.collectionRate)
      : dentrixNetProduction > 0
        ? (dentrixTotalCollections / dentrixNetProduction) * 100
        : null;

  // ── Resolve per-office breakdown from Dentrix ─────────────────────────────
  // Use dentrixData.officeBreakdown (Dentrix per-office data) if available.
  // Fall back to an empty array — do NOT use kpiData.officeBreakdown (daily_entries).
  const dentrixOfficeBreakdown = Array.isArray(dentrixData?.officeBreakdown)
    ? dentrixData?.officeBreakdown
    : [];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc?.internal?.pageSize?.getWidth();
  const pageHeight = doc?.internal?.pageSize?.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── HEADER BAND ──────────────────────────────────────────────────────────
  doc?.setFillColor(BRAND?.slate);
  doc?.rect(0, 0, pageWidth, 28, 'F');

  // Logo placeholder text (white)
  doc?.setTextColor(BRAND?.white);
  doc?.setFontSize(18);
  doc?.setFont('helvetica', 'bold');
  doc?.text('NuDental', margin, 14);
  doc?.setFontSize(8);
  doc?.setFont('helvetica', 'normal');
  doc?.text('MANAGEMENT GROUP', margin, 19);

  // Report title (right-aligned)
  doc?.setFontSize(10);
  doc?.setFont('helvetica', 'bold');
  doc?.text('Monthly Performance Summary', pageWidth - margin, 11, { align: 'right' });
  doc?.setFontSize(9);
  doc?.setFont('helvetica', 'normal');
  doc?.text(resolvedPeriodLabel, pageWidth - margin, 17, { align: 'right' });
  doc?.setFontSize(7);
  doc?.text('CONFIDENTIAL — EXECUTIVE USE ONLY', pageWidth - margin, 23, { align: 'right' });

  y = 36;

  // ── DATA SOURCE NOTICE ────────────────────────────────────────────────────
  doc?.setFillColor('#eff6ff');
  doc?.setDrawColor('#bfdbfe');
  doc?.setLineWidth(0.3);
  doc?.roundedRect(margin, y, contentWidth, 8, 1, 1, 'FD');
  doc?.setTextColor('#1d4ed8');
  doc?.setFontSize(6.5);
  doc?.setFont('helvetica', 'italic');
  doc?.text(
    'Financial data sourced from Dentrix Ascend live integration. Net Production = ledger production after adjustments. Collection % = Actual Collections ÷ Net Production.',
    margin + 3,
    y + 5,
    { maxWidth: contentWidth - 6 }
  );
  doc?.setTextColor(BRAND?.slate);
  y += 12;

  // ── KPI GROUP TOTALS TABLE — DENTRIX SOURCE ───────────────────────────────
  y = drawSectionHeader(doc, '📊 Group KPI Summary — ' + resolvedPeriodLabel + ' (Dentrix Ascend)', y, margin, pageWidth);
  y += 4;

  const collRateDisplay =
    dentrixCollectionRate !== null
      ? `${dentrixCollectionRate?.toFixed(1)}%`
      : 'N/A';

  const kpiRows = [
    ['Net Production', fmtCurrency(dentrixNetProduction)],
    ['Actual Collections', fmtCurrency(dentrixTotalCollections)],
    ['New Patients', String(dentrixNewPatients)],
    ['Collection Rate', collRateDisplay],
  ];

  const kpiColW = contentWidth / 4;
  // Header row
  doc?.setFillColor(BRAND?.indigoLight);
  doc?.rect(margin, y, contentWidth, 7, 'F');
  doc?.setTextColor(BRAND?.indigo);
  doc?.setFontSize(7.5);
  doc?.setFont('helvetica', 'bold');
  kpiRows?.forEach(([label], i) => {
    doc?.text(label, margin + kpiColW * i + kpiColW / 2, y + 4.8, { align: 'center' });
  });
  y += 7;

  // Value row
  doc?.setFillColor(BRAND?.white);
  doc?.rect(margin, y, contentWidth, 9, 'F');
  doc?.setDrawColor(BRAND?.border);
  doc?.setLineWidth(0.2);
  doc?.rect(margin, y, contentWidth, 9);
  doc?.setTextColor(BRAND?.slate);
  doc?.setFontSize(11);
  doc?.setFont('helvetica', 'bold');
  kpiRows?.forEach(([, value], i) => {
    doc?.text(value, margin + kpiColW * i + kpiColW / 2, y + 6.2, { align: 'center' });
  });
  y += 9 + 8;

  // ── OFFICE BREAKDOWN TABLE — DENTRIX SOURCE ───────────────────────────────
  if (dentrixOfficeBreakdown?.length > 0) {
    y = drawSectionHeader(doc, '🏢 Office Breakdown — Dentrix Ascend Live Data', y, margin, pageWidth);
    y += 4;

    const offices = dentrixOfficeBreakdown;
    const officeColW = contentWidth / (offices?.length + 1);
    const officeHeaders = ['Metric', ...offices?.map((o) => (o?.name || '—')?.replace('Nu Dental of ', ''))];
    const officeMetrics = [
      ['Net Production', ...offices?.map((o) => fmtCurrency(Math.abs(parseFloat(o?.netProduction ?? 0))))],
      ['Actual Collections', ...offices?.map((o) => fmtCurrency(Math.abs(parseFloat(o?.totalCollections ?? 0))))],
      ['New Patients', ...offices?.map((o) => String(parseInt(o?.newPatients ?? 0, 10)))],
      ['Collection Rate', ...offices?.map((o) => {
        const net = Math.abs(parseFloat(o?.netProduction ?? 0));
        const coll = Math.abs(parseFloat(o?.totalCollections ?? 0));
        const rate = o?.collectionRate != null
          ? parseFloat(o?.collectionRate)
          : net > 0 ? (coll / net) * 100 : null;
        return rate !== null ? `${rate?.toFixed(1)}%` : 'N/A';
      })],
    ];

    // Table header
    doc?.setFillColor(BRAND?.slate);
    doc?.rect(margin, y, contentWidth, 7, 'F');
    doc?.setTextColor(BRAND?.white);
    doc?.setFontSize(7.5);
    doc?.setFont('helvetica', 'bold');
    officeHeaders?.forEach((h, i) => {
      doc?.text(h, margin + officeColW * i + (i === 0 ? 3 : officeColW / 2), y + 4.8, {
        align: i === 0 ? 'left' : 'center',
      });
    });
    y += 7;

    // Table rows
    officeMetrics?.forEach((row, rowIdx) => {
      const bg = rowIdx % 2 === 0 ? BRAND?.white : BRAND?.bg;
      doc?.setFillColor(bg);
      doc?.rect(margin, y, contentWidth, 7, 'F');
      doc?.setDrawColor(BRAND?.border);
      doc?.setLineWidth(0.15);
      doc?.line(margin, y + 7, margin + contentWidth, y + 7);
      doc?.setTextColor(BRAND?.slate);
      doc?.setFontSize(8);
      row?.forEach((cell, i) => {
        doc?.setFont('helvetica', i === 0 ? 'bold' : 'normal');
        doc?.text(cell, margin + officeColW * i + (i === 0 ? 3 : officeColW / 2), y + 4.8, {
          align: i === 0 ? 'left' : 'center',
        });
      });
      y += 7;
    });

    y += 8;
  }

  // ── GROWTH ANALYSIS ───────────────────────────────────────────────────────
  if (growthData) {
    y = drawSectionHeader(doc, '📈 Growth Analysis — Month-over-Month', y, margin, pageWidth);
    y += 4;

    // Top Performing Office badge
    const topOffice = growthData?.rankedOffices?.[0];
    if (topOffice) {
      doc?.setFillColor('#fef9c3');
      doc?.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc?.setDrawColor('#fbbf24');
      doc?.setLineWidth(0.4);
      doc?.roundedRect(margin, y, contentWidth, 10, 2, 2, 'S');
      doc?.setTextColor('#92400e');
      doc?.setFontSize(8.5);
      doc?.setFont('helvetica', 'bold');
      doc?.text(
        `🏆 Top Performing Office: ${topOffice?.office_name}  —  Production Growth: ${fmtPct(topOffice?.production_growth_pct)}`,
        pageWidth / 2,
        y + 6.5,
        { align: 'center' }
      );
      y += 14;
    }

    // Growth leaderboard table
    const growthHeaders = ['Rank', 'Office', 'Prev Production', 'Curr Production', 'Prod Growth', 'Coll Growth', 'NP Growth'];
    const growthColWidths = [12, 38, 30, 30, 24, 24, 22];
    const growthRows = [
      ...(growthData?.rankedOffices || [])?.map((o, i) => [
        `#${i + 1}`,
        o?.office_name,
        fmtCurrency(o?.prev_production),
        fmtCurrency(o?.current_production),
        fmtPct(o?.production_growth_pct),
        fmtPct(o?.collection_growth_pct),
        fmtPct(o?.new_patients_growth_pct),
      ]),
      growthData?.groupTotal
        ? [
            '—',
            'Group Total',
            fmtCurrency(growthData?.groupTotal?.prev_production),
            fmtCurrency(growthData?.groupTotal?.current_production),
            fmtPct(growthData?.groupTotal?.production_growth_pct),
            fmtPct(growthData?.groupTotal?.collection_growth_pct),
            fmtPct(growthData?.groupTotal?.new_patients_growth_pct),
          ]
        : null,
    ]?.filter(Boolean);

    // Header
    doc?.setFillColor(BRAND?.indigoLight);
    doc?.rect(margin, y, contentWidth, 7, 'F');
    doc?.setTextColor(BRAND?.indigo);
    doc?.setFontSize(7);
    doc?.setFont('helvetica', 'bold');
    let xCursor = margin;
    growthHeaders?.forEach((h, i) => {
      doc?.text(h, xCursor + (i === 1 ? 2 : growthColWidths?.[i] / 2), y + 4.8, {
        align: i === 1 ? 'left' : 'center',
      });
      xCursor += growthColWidths?.[i];
    });
    y += 7;

    growthRows?.forEach((row, rowIdx) => {
      const isGroupTotal = row?.[1] === 'Group Total';
      const bg = isGroupTotal ? BRAND?.indigoLight : rowIdx % 2 === 0 ? BRAND?.white : BRAND?.bg;
      doc?.setFillColor(bg);
      doc?.rect(margin, y, contentWidth, 7, 'F');
      doc?.setDrawColor(BRAND?.border);
      doc?.setLineWidth(0.15);
      doc?.line(margin, y + 7, margin + contentWidth, y + 7);
      xCursor = margin;
      row?.forEach((cell, i) => {
        const isGrowthCol = i >= 4;
        const isPos = isGrowthCol && cell?.startsWith('+');
        const isNeg = isGrowthCol && cell?.startsWith('-');
        doc?.setTextColor(isPos ? '#059669' : isNeg ? '#dc2626' : isGroupTotal ? BRAND?.indigo : BRAND?.slate);
        doc?.setFontSize(7);
        doc?.setFont('helvetica', isGroupTotal ? 'bold' : 'normal');
        doc?.text(cell, xCursor + (i === 1 ? 2 : growthColWidths?.[i] / 2), y + 4.8, {
          align: i === 1 ? 'left' : 'center',
        });
        xCursor += growthColWidths?.[i];
      });
      y += 7;
    });

    y += 8;
  }

  // ── MONTHLY GROWTH CHART (if captured) ────────────────────────────────────
  if (chartImageData) {
    // Check if we need a new page
    if (y + 65 > pageHeight - 20) {
      drawFooter(doc, pageWidth, pageHeight, margin, dateGenerated);
      doc?.addPage();
      y = margin;
    }
    y = drawSectionHeader(doc, '📊 Monthly Growth Chart', y, margin, pageWidth);
    y += 4;
    doc?.addImage(chartImageData, 'PNG', margin, y, contentWidth, 55);
    y += 59;
  }

  // ── PROVIDER RANKINGS ─────────────────────────────────────────────────────
  if (y + 50 > pageHeight - 20) {
    drawFooter(doc, pageWidth, pageHeight, margin, dateGenerated);
    doc?.addPage();
    y = margin;
  }

  y = drawSectionHeader(doc, '👨‍⚕️ Top 3 Producers — Organization-Wide', y, margin, pageWidth);
  y += 4;

  // topProviders comes from daily_entries (provider name lookup — workflow data)
  // Clearly labeled as "from EOD workflow entries"
  const topProviders = dentrixData?.topProviders || [];

  if (topProviders?.length > 0) {
    const provHeaders = ['Rank', 'Provider', 'Office', 'Production', 'Collection'];
    const provColWidths = [15, 55, 45, 35, 30];

    doc?.setFillColor(BRAND?.indigoLight);
    doc?.rect(margin, y, contentWidth, 7, 'F');
    doc?.setTextColor(BRAND?.indigo);
    doc?.setFontSize(7.5);
    doc?.setFont('helvetica', 'bold');
    let xCursor2 = margin;
    provHeaders?.forEach((h, i) => {
      doc?.text(h, xCursor2 + (i <= 1 ? 3 : provColWidths?.[i] / 2), y + 4.8, {
        align: i <= 1 ? 'left' : 'center',
      });
      xCursor2 += provColWidths?.[i];
    });
    y += 7;

    topProviders?.slice(0, 3)?.forEach((prov, idx) => {
      const medals = ['🥇', '🥈', '🥉'];
      const bg = idx % 2 === 0 ? BRAND?.white : BRAND?.bg;
      doc?.setFillColor(bg);
      doc?.rect(margin, y, contentWidth, 8, 'F');
      doc?.setDrawColor(BRAND?.border);
      doc?.setLineWidth(0.15);
      doc?.line(margin, y + 8, margin + contentWidth, y + 8);
      const row = [
        medals?.[idx] || `#${idx + 1}`,
        prov?.provider_name || '—',
        (prov?.office_name || '—')?.replace('Nu Dental of ', ''),
        fmtCurrency(prov?.production),
        fmtCurrency(prov?.collection),
      ];
      let xCursor3 = margin;
      row?.forEach((cell, i) => {
        doc?.setTextColor(BRAND?.slate);
        doc?.setFontSize(7.5);
        doc?.setFont('helvetica', i === 1 ? 'bold' : 'normal');
        doc?.text(cell, xCursor3 + (i <= 1 ? 3 : provColWidths?.[i] / 2), y + 5.2, {
          align: i <= 1 ? 'left' : 'center',
        });
        xCursor3 += provColWidths?.[i];
      });
      y += 8;
    });

    // Note: provider data from EOD workflow entries
    y += 4;
    doc?.setFontSize(6.5);
    doc?.setFont('helvetica', 'italic');
    doc?.setTextColor(BRAND?.muted);
    doc?.text('* Provider rankings sourced from EOD workflow entries (daily_entries). Financial totals above are from Dentrix Ascend.', margin, y);
    y += 6;
  } else {
    doc?.setFillColor(BRAND?.bg);
    doc?.rect(margin, y, contentWidth, 12, 'F');
    doc?.setTextColor(BRAND?.muted);
    doc?.setFontSize(8);
    doc?.setFont('helvetica', 'italic');
    doc?.text(
      'Provider-level data not available for this period. Import daily entries with provider names to populate this section.',
      pageWidth / 2,
      y + 7.5,
      { align: 'center', maxWidth: contentWidth - 8 }
    );
    y += 16;
  }

  // ── FOOTER on last page ───────────────────────────────────────────────────
  drawFooter(doc, pageWidth, pageHeight, margin, dateGenerated);

  // Also add footer to page 1 if multi-page
  const totalPages = doc?.internal?.getNumberOfPages();
  if (totalPages > 1) {
    for (let p = 1; p <= totalPages; p++) {
      doc?.setPage(p);
      drawFooter(doc, pageWidth, pageHeight, margin, dateGenerated);
      // Page number
      doc?.setFontSize(7);
      doc?.setTextColor(BRAND?.muted);
      doc?.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
    }
  }

  return doc;
};

/**
 * Fetch top 3 providers for the given date range from daily_entries.
 * NOTE: This is WORKFLOW DATA ONLY — provider names from EOD entries.
 * It is NOT used for financial totals. Financial totals come from Dentrix Ascend.
 */
export const fetchTopProviders = async (supabase, month, year) => {
  const { format: dateFmt, endOfMonth } = await import('date-fns');
  const monthStart = dateFmt(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const monthEnd = dateFmt(endOfMonth(new Date(year, month - 1, 1)), 'yyyy-MM-dd');

  const { data, error } = await supabase?.from('daily_entries')?.select('provider_name, office_id, production, collection')?.gte('entry_date', monthStart)?.lte('entry_date', monthEnd)?.not('provider_name', 'is', null);

  if (error || !data) return [];

  // Aggregate by provider
  const providerMap = {};
  data?.forEach((row) => {
    const key = row?.provider_name;
    if (!providerMap?.[key]) {
      providerMap[key] = { provider_name: key, production: 0, collection: 0, office_id: row?.office_id };
    }
    providerMap[key].production += parseFloat(row?.production || 0);
    providerMap[key].collection += parseFloat(row?.collection || 0);
  });

  return Object.values(providerMap)?.sort((a, b) => b?.production - a?.production)?.slice(0, 3);
};
