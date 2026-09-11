/**
 * fullWorkbookService.js — V589
 * ══════════════════════════════════════════════════════════════════════════════
 * Full Workbook XLSX Export Service — Nu Dental Branded
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * V589 Branding Patch:
 *   - Nu Dental branded text header on every sheet (logo embedding not supported
 *     by SheetJS community edition without additional image-support library)
 *   - Nu Dental color scheme: cyan/teal header (#0891B2), light blue fills (#E0F2FE),
 *     alternating row fills (#F8FAFC / white)
 *   - Bold styled table headers with background color
 *   - Freeze panes below the metadata/title/header area on every sheet
 *   - Autofilter on main table regions
 *   - Useful column widths per sheet
 *   - Number formatting: currency, percent, integer, date
 *   - "Confidential — Internal Use Only" footer on every sheet
 *   - Source Notes sheet cleaned up; Patient Flow exclusion note removed
 *
 * NOTE ON LOGO EMBEDDING:
 *   SheetJS community edition (xlsx npm package) does not support embedding
 *   actual image files into XLSX cells/headers without the Pro/image add-on or
 *   a separate library (e.g. exceljs). To embed the actual Nu Dental logo PNG,
 *   either: (a) use the backend-generated Full Workbook via Yabezy which already
 *   embeds the logo, or (b) approve adding exceljs as a dependency. For now,
 *   "NU DENTAL" text branding is used in the header row.
 *
 * Sources (unchanged from V588):
 *   - Dentrix/FastAPI (ascendApi) for production, collections, provider actuals
 *   - Finance Expense Report (fetchExpenseKPIs) for expense totals
 *   - office_goals + Dentrix/FastAPI collections for goal leaderboard
 *   - fetchTreatmentPlanCompletion for treatment plan completion
 *   - ascendApi.getPatients + getAppointmentsSummary for Patient Flow
 *
 * Hard rules (unchanged):
 *   - No daily_entries, revenue_entries, MEA as official values
 *   - No patient-level PHI
 *   - phi_flag: false always
 *   - Missing values render N/A or — (never fake $0)
 *   - Real backend 0 renders as 0 / $0
 *   - Audit insert MUST succeed before file download
 *   - Do NOT use service role key
 */

import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { ascendApi } from './ascendApi';
import { fetchExpenseKPIs } from './expenseReportService';
import { fetchTreatmentPlanCompletion } from './eodTreatmentService';
import { getGoalAchievement } from './goalsService';
import { OFFICE_MAP, getLocationIdByOfficeId } from '../constants/offices';
import { format, startOfYear, startOfMonth, subMonths, endOfMonth, startOfQuarter, subQuarters } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────
const SOURCE_VERSION = 'V589';
const COMPLETION_WINDOW_DAYS = 90;
const NA = 'N/A';

// ── Nu Dental Brand Colors ────────────────────────────────────────────────────
// These are ARGB hex strings as required by SheetJS cell styles (AARRGGBB format)
const BRAND = {
  // Primary cyan/teal header — Nu Dental brand
  headerBg: 'FF0891B2',       // #0891B2 cyan-600
  headerFg: 'FFFFFFFF',       // white text
  // Section sub-header
  subHeaderBg: 'FF0E7490',    // #0E7490 cyan-700
  subHeaderFg: 'FFFFFFFF',
  // Light blue fill for metadata/info rows
  infoBg: 'FFE0F2FE',         // #E0F2FE sky-100
  infoFg: 'FF0C4A6E',         // #0C4A6E sky-900
  // Alternating row A (light)
  rowAltA: 'FFF8FAFC',        // #F8FAFC slate-50
  rowAltB: 'FFFFFFFF',        // white
  // Table header row
  tableHeaderBg: 'FF164E63',  // #164E63 cyan-900
  tableHeaderFg: 'FFFFFFFF',
  // Confidential footer
  confBg: 'FFFFF7ED',         // #FFF7ED orange-50
  confFg: 'FF9A3412',         // #9A3412 orange-800
  // Total/summary rows
  totalBg: 'FFE0F2FE',
  totalFg: 'FF0C4A6E',
};

// ── Formatters (text — used for display strings) ──────────────────────────────
const fmtCurrency = (v) => {
  if (v === null || v === undefined || isNaN(v)) return NA;
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtPct = (v) => {
  if (v === null || v === undefined || isNaN(v)) return NA;
  const n = Math.abs(v) <= 1 ? v * 100 : v;
  return `${Number(n).toFixed(1)}%`;
};

const fmtNum = (v) => {
  if (v === null || v === undefined || isNaN(v)) return NA;
  return Number(v).toLocaleString('en-US');
};

const fmtDays = (v) => {
  if (v === null || v === undefined || isNaN(v)) return NA;
  return `${Math.round(v)} days`;
};

// ── Date range resolver ───────────────────────────────────────────────────────
export function resolveReportDateRange(dateFilter) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  if (!dateFilter || dateFilter === 'ytd_2026' || dateFilter === 'ytd') {
    return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: todayStr };
  }
  if (dateFilter === 'this_month') {
    return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: todayStr };
  }
  if (dateFilter === 'last_month') {
    const lm = subMonths(now, 1);
    return { start: format(startOfMonth(lm), 'yyyy-MM-dd'), end: format(endOfMonth(lm), 'yyyy-MM-dd') };
  }
  if (dateFilter === 'this_quarter') {
    return { start: format(startOfQuarter(now), 'yyyy-MM-dd'), end: todayStr };
  }
  if (dateFilter === 'last_quarter') {
    const lq = subQuarters(now, 1);
    return {
      start: format(startOfQuarter(lq), 'yyyy-MM-dd'),
      end: format(endOfMonth(subMonths(now, (now.getMonth() % 3) + 1)), 'yyyy-MM-dd'),
    };
  }
  const qMatch = dateFilter?.match(/^q([1-4])_(\d{4})$/);
  if (qMatch) {
    const q = Number(qMatch[1]);
    let yr = Number(qMatch[2]);
    const startMonth = (q - 1) * 3;
    return {
      start: format(new Date(yr, startMonth, 1), 'yyyy-MM-dd'),
      end: format(new Date(yr, startMonth + 3, 0), 'yyyy-MM-dd'),
    };
  }
  const ytdMatch = dateFilter?.match(/^ytd_(\d{4})$/);
  if (ytdMatch) {
    let yr = parseInt(ytdMatch[1], 10);
    const end = yr === now.getFullYear() ? todayStr : `${yr}-12-31`;
    return { start: `${yr}-01-01`, end };
  }
  const fyMatch = dateFilter?.match(/^fy_(\d{4})$/);
  if (fyMatch) {
    let yr = parseInt(fyMatch[1], 10);
    return { start: `${yr}-01-01`, end: `${yr}-12-31` };
  }
  return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: todayStr };
}

// ── Office helpers ────────────────────────────────────────────────────────────
function resolveOfficeLabel(officeFilter) {
  if (!officeFilter || officeFilter.includes('all') || officeFilter.length === 0) {
    return 'All Offices';
  }
  if (officeFilter.length === 1) {
    return OFFICE_MAP[officeFilter[0]]?.name || officeFilter[0];
  }
  return officeFilter.map(id => OFFICE_MAP[id]?.name || id).join(', ');
}

function sanitizeFilename(str) {
  return (str || 'all').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

function resolveLocationId(officeFilter) {
  if (!officeFilter || officeFilter.includes('all') || officeFilter.length !== 1) return null;
  return getLocationIdByOfficeId(officeFilter[0]) || null;
}

function resolveOfficeIds(officeFilter) {
  if (!officeFilter || officeFilter.includes('all') || officeFilter.length === 0) return [];
  return officeFilter.filter(id => id && id !== 'all');
}

// ── XLSX Cell Style Helpers ───────────────────────────────────────────────────

/**
 * Create a styled cell object for SheetJS.
 * SheetJS community edition supports basic cell styles when using write with
 * cellStyles: true option (supported in xlsx >= 0.18).
 */
function styledCell(value, styleOverrides = {}) {
  return {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
    s: styleOverrides,
  };
}

function headerCell(value) {
  return {
    v: value,
    t: 's',
    s: {
      font: { bold: true, color: { rgb: BRAND.headerFg }, sz: 14 },
      fill: { fgColor: { rgb: BRAND.headerBg } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
    },
  };
}

function tableHeaderCell(value) {
  return {
    v: value,
    t: 's',
    s: {
      font: { bold: true, color: { rgb: BRAND.tableHeaderFg }, sz: 10 },
      fill: { fgColor: { rgb: BRAND.tableHeaderBg } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        bottom: { style: 'thin', color: { rgb: 'FF0891B2' } },
      },
    },
  };
}

function metaLabelCell(value) {
  return {
    v: value,
    t: 's',
    s: {
      font: { bold: true, color: { rgb: BRAND.infoFg }, sz: 10 },
      fill: { fgColor: { rgb: BRAND.infoBg } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };
}

function metaValueCell(value) {
  return {
    v: value ?? '',
    t: 's',
    s: {
      font: { color: { rgb: BRAND.infoFg }, sz: 10 },
      fill: { fgColor: { rgb: BRAND.infoBg } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };
}

function sectionHeaderCell(value) {
  return {
    v: value,
    t: 's',
    s: {
      font: { bold: true, color: { rgb: BRAND.subHeaderFg }, sz: 11 },
      fill: { fgColor: { rgb: BRAND.subHeaderBg } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };
}

function dataCell(value, rowIndex = 0) {
  const isAlt = rowIndex % 2 === 0;
  return {
    v: value ?? '',
    t: 's',
    s: {
      font: { sz: 10 },
      fill: { fgColor: { rgb: isAlt ? BRAND.rowAltA : BRAND.rowAltB } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };
}

function totalCell(value) {
  return {
    v: value ?? '',
    t: 's',
    s: {
      font: { bold: true, color: { rgb: BRAND.totalFg }, sz: 10 },
      fill: { fgColor: { rgb: BRAND.totalBg } },
      alignment: { horizontal: 'left', vertical: 'center' },
    },
  };
}

function confidentialCell(value) {
  return {
    v: value,
    t: 's',
    s: {
      font: { bold: true, italic: true, color: { rgb: BRAND.confFg }, sz: 9 },
      fill: { fgColor: { rgb: BRAND.confBg } },
      alignment: { horizontal: 'center', vertical: 'center' },
    },
  };
}

function emptyCell() {
  return { v: '', t: 's', s: {} };
}

// ── Branded Header Builder ────────────────────────────────────────────────────
/**
 * Build the standard Nu Dental branded header rows for every sheet.
 * Returns an array of rows (each row is an array of cell objects).
 * HEADER_ROW_COUNT = 7 (rows 0-6), so freeze panes at row 7.
 */
function buildBrandedHeader({ sheetTitle, dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole }) {
  const genAtFormatted = generatedAt
    ? new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : NA;

  return [
    // Row 0: NU DENTAL brand header
    [headerCell('NU DENTAL'), headerCell(''), headerCell(''), headerCell(''), headerCell(''), headerCell('Confidential — Internal Use Only')],
    // Row 1: Sheet title
    [sectionHeaderCell(sheetTitle), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    // Row 2: blank separator
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    // Row 3: Date range
    [metaLabelCell('Date Range'), metaValueCell(`${dateStart} to ${dateEnd}`), emptyCell(), metaLabelCell('Office'), metaValueCell(officeLabel), emptyCell()],
    // Row 4: Generated info
    [metaLabelCell('Generated At'), metaValueCell(genAtFormatted), emptyCell(), metaLabelCell('Generated By'), metaValueCell(generatedBy || NA), emptyCell()],
    // Row 5: Role / version
    [metaLabelCell('User Role'), metaValueCell(userRole || NA), emptyCell(), metaLabelCell('Source Version'), metaValueCell(SOURCE_VERSION), emptyCell()],
    // Row 6: blank separator before data
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];
}

const HEADER_ROW_COUNT = 7; // rows 0-6 are the branded header

// ── Branded Footer Builder ────────────────────────────────────────────────────
function buildConfidentialFooter(colCount = 6) {
  const cells = [confidentialCell('Confidential — Internal Use Only | Nu Dental | This report is for internal use only. Do not distribute.')];
  for (let i = 1; i < colCount; i++) cells.push(emptyCell());
  return [cells];
}

// ── Sheet style application ───────────────────────────────────────────────────
/**
 * Apply column widths, freeze panes, and autofilter to a worksheet.
 * @param {object} ws - SheetJS worksheet
 * @param {number[]} colWidths - array of column widths in characters
 * @param {number} freezeRow - row index to freeze at (0-based, freeze BELOW this row)
 * @param {boolean} autofilter - whether to add autofilter
 * @param {number} dataStartRow - 0-based row index where data table starts (for autofilter)
 */
function finalizeSheet(ws, colWidths = [], freezeRow = HEADER_ROW_COUNT, autofilter = true, dataStartRow = HEADER_ROW_COUNT) {
  // Column widths
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  // Freeze panes below header
  ws['!freeze'] = { xSplit: 0, ySplit: freezeRow, topLeftCell: `A${freezeRow + 1}`, activePane: 'bottomLeft' };

  // Autofilter on the header row of the data table
  if (autofilter && ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const filterRow = dataStartRow; // 0-based
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: filterRow, c: range.s.c },
        e: { r: filterRow, c: range.e.c },
      }),
    };
  }

  return ws;
}

/**
 * Convert a 2D array of cell objects (or plain values) to a SheetJS worksheet.
 * Handles mixed arrays: plain strings/numbers and styledCell objects.
 */
function aoaToStyledSheet(rows) {
  const ws = {};
  let maxR = 0;
  let maxC = 0;

  rows.forEach((row, r) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (cell === null || cell === undefined) {
        ws[addr] = { v: '', t: 's' };
      } else if (typeof cell === 'object' && 'v' in cell) {
        ws[addr] = cell;
      } else {
        ws[addr] = { v: cell, t: typeof cell === 'number' ? 'n' : 's' };
      }
      if (c > maxC) maxC = c;
    });
    if (r > maxR) maxR = r;
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return ws;
}

// ── Sheet builders ────────────────────────────────────────────────────────────

/**
 * Sheet 1: Executive Summary / Cover
 */
function buildExecutiveSummarySheet({ netProduction, totalCollections, totalExpenses, dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole }) {
  const estNetProfit = (totalCollections != null && totalExpenses != null)
    ? totalCollections - totalExpenses
    : null;

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Executive Summary / Cover',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const kpiHeader = [
    tableHeaderCell('Metric'),
    tableHeaderCell('Value'),
    tableHeaderCell('Source'),
    emptyCell(), emptyCell(), emptyCell(),
  ];

  const kpiRows = [
    [dataCell('Net Production', 0), dataCell(fmtCurrency(netProduction), 0), dataCell('Dentrix/FastAPI /v2/production/summary → netProduction', 0), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Total Collections', 1), dataCell(fmtCurrency(totalCollections), 1), dataCell('Dentrix/FastAPI /v2/collections/summary → totalCollections', 1), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Total Expenses', 0), dataCell(fmtCurrency(totalExpenses), 0), dataCell('Finance Expense Report — fetchExpenseKPIs → totalExpenses', 0), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Est. Net Profit', 1), dataCell(fmtCurrency(estNetProfit), 1), dataCell('Formula: Total Collections − Total Expenses', 1), emptyCell(), emptyCell(), emptyCell()],
  ];

  const sheetsSection = [
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [sectionHeaderCell('SHEETS INCLUDED IN THIS WORKBOOK'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    [dataCell('1. Executive Summary / Cover', 0), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('2. P&L Summary', 1), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('3. Expense Breakdown', 0), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('4. Goal Leaderboard', 1), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('5. Period Comparison', 0), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('6. Provider Production & Collections', 1), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('7. Office Comparison', 0), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('8. Treatment Plan Completion', 1), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('9. Patient Flow', 0), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('10. Source Notes / Audit Metadata', 1), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('PHI Status'), metaValueCell('Aggregate-only workbook. No patient-level PHI included.'), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('Audit Notice'), metaValueCell('This export has been logged in report_export_audit_log.'), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];

  const footer = buildConfidentialFooter(6);

  const allRows = [
    ...headerRows,
    [sectionHeaderCell('EXECUTIVE KPI SUMMARY'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    kpiHeader,
    ...kpiRows,
    ...sheetsSection,
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return finalizeSheet(ws, [30, 22, 55, 18, 28, 18], HEADER_ROW_COUNT, false);
}

/**
 * Sheet 2: P&L Summary
 */
async function buildPLSummarySheet({ dateStart, dateEnd, locationId, officeIds, officeLabel, generatedAt, generatedBy, userRole }) {
  const startYear = parseInt(dateStart.slice(0, 4), 10);
  const endYear = parseInt(dateEnd.slice(0, 4), 10);
  const startMonth = parseInt(dateStart.slice(5, 7), 10);
  const endMonth = parseInt(dateEnd.slice(5, 7), 10);

  const months = [];
  for (let yr = startYear; yr <= endYear; yr++) {
    const mStart = yr === startYear ? startMonth : 1;
    const mEnd = yr === endYear ? endMonth : 12;
    for (let m = mStart; m <= mEnd; m++) {
      months.push({ year: yr, month: m });
    }
  }

  const monthsToFetch = months.slice(0, 24);

  const results = await Promise.allSettled(
    monthsToFetch.map(async ({ year, month }) => {
      const mStr = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      const rowStart = `${year}-${mStr}-01`;
      const rowEnd = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;

      const clippedStart = rowStart < dateStart ? dateStart : rowStart;
      const clippedEnd = rowEnd > dateEnd ? dateEnd : rowEnd;
      if (clippedStart > clippedEnd) return null;

      const [prodResult, collResult, expResult] = await Promise.allSettled([
        ascendApi.getProduction(clippedStart, clippedEnd, locationId),
        ascendApi.getCollections(clippedStart, clippedEnd, locationId),
        fetchExpenseKPIs({ startDate: clippedStart, endDate: clippedEnd, officeIds }),
      ]);

      const prod = prodResult.status === 'fulfilled' ? prodResult.value : null;
      const coll = collResult.status === 'fulfilled' ? collResult.value : null;
      const exp = expResult.status === 'fulfilled' ? expResult.value : null;

      const netProd = prod?.netProduction ?? prod?.net_production ?? null;
      const grossProd = prod?.grossProduction ?? prod?.gross_production ?? null;
      const adjustments = prod?.adjustments ?? null;
      const totalColl = coll?.totalCollections ?? coll?.total_collections ?? null;
      const totalExp = exp?.totalExpenses ?? null;

      const collRate = (netProd != null && netProd > 0 && totalColl != null)
        ? (totalColl / netProd) * 100 : null;
      const netProfit = (totalColl != null && totalExp != null)
        ? totalColl - totalExp : null;
      const margin = (totalColl != null && totalColl > 0 && netProfit != null)
        ? (netProfit / totalColl) * 100 : null;

      return { month: `${year}-${mStr}`, grossProd, adjustments, netProd, totalColl, collRate, totalExp, netProfit, margin };
    })
  );

  const headerRows = buildBrandedHeader({
    sheetTitle: 'P&L Summary',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const colHeaders = [
    tableHeaderCell('Month'),
    tableHeaderCell('Gross Production'),
    tableHeaderCell('Adjustments'),
    tableHeaderCell('Net Production'),
    tableHeaderCell('Total Collections'),
    tableHeaderCell('Collection Rate'),
    tableHeaderCell('Total Expenses'),
    tableHeaderCell('Net Profit'),
    tableHeaderCell('Margin %'),
  ];

  const dataRows = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map((r, i) => {
      const d = r.value;
      return [
        dataCell(d.month, i),
        dataCell(fmtCurrency(d.grossProd), i),
        dataCell(fmtCurrency(d.adjustments), i),
        dataCell(fmtCurrency(d.netProd), i),
        dataCell(fmtCurrency(d.totalColl), i),
        dataCell(fmtPct(d.collRate), i),
        dataCell(fmtCurrency(d.totalExp), i),
        dataCell(fmtCurrency(d.netProfit), i),
        dataCell(fmtPct(d.margin), i),
      ];
    });

  const footer = buildConfidentialFooter(9);

  const allRows = [
    ...headerRows,
    colHeaders,
    ...dataRows,
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return {
    ws: finalizeSheet(ws, [14, 18, 16, 18, 18, 16, 16, 16, 12], HEADER_ROW_COUNT, true, HEADER_ROW_COUNT),
    rowCount: dataRows.length,
  };
}

/**
 * Sheet 3: Expense Breakdown
 */
async function buildExpenseBreakdownSheet({ dateStart, dateEnd, officeIds, officeLabel, generatedAt, generatedBy, userRole }) {
  let kpis = null;
  try {
    kpis = await fetchExpenseKPIs({ startDate: dateStart, endDate: dateEnd, officeIds });
  } catch (err) {
    console.warn('[fullWorkbookService] Expense Breakdown fetch failed:', err?.message);
  }

  const payrollAndTaxes = kpis ? ((kpis.payrollExpense ?? 0) + (kpis.payrollTaxes ?? 0)) : null;
  const benefits = kpis?.benefitsExpense ?? null;
  const amexNet = kpis?.amexExpense ?? null;
  const amexCharges = kpis?.amexCharges ?? null;
  const amexCredits = kpis?.amexCredits ?? null;
  const wfDirect = kpis?.wfBankingExpense ?? null;
  const totalExpenses = kpis?.totalExpenses ?? null;

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Expense Breakdown',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const colHeaders = [
    tableHeaderCell('Expense Category'),
    tableHeaderCell('Amount'),
    tableHeaderCell('Source'),
  ];

  const expRows = [
    [dataCell('Payroll + Payroll Taxes', 0), dataCell(fmtCurrency(payrollAndTaxes), 0), dataCell('Finance Expense Report — Gusto payroll facts', 0)],
    [dataCell('Benefits', 1), dataCell(fmtCurrency(benefits), 1), dataCell('Finance Expense Report — backend totals.benefits', 1)],
    [dataCell('AmEx / Corporate Card (Net)', 0), dataCell(fmtCurrency(amexNet), 0), dataCell('Finance Expense Report — AmEx net (charges minus credits)', 0)],
    [dataCell('  AmEx Charges', 1), dataCell(fmtCurrency(amexCharges), 1), dataCell('Finance Expense Report — AmEx charges gross', 1)],
    [dataCell('  AmEx Credits / Refunds', 0), dataCell(fmtCurrency(amexCredits), 0), dataCell('Finance Expense Report — AmEx credits/refunds', 0)],
    [dataCell('WF Direct Operating', 1), dataCell(fmtCurrency(wfDirect), 1), dataCell('Finance Expense Report — WF Banking money-out', 1)],
    [emptyCell(), emptyCell(), emptyCell()],
    [totalCell('TOTAL EXPENSES'), totalCell(fmtCurrency(totalExpenses)), totalCell('Finance Expense Report — fetchExpenseKPIs → totalExpenses')],
  ];

  const footer = buildConfidentialFooter(3);

  const allRows = [
    ...headerRows,
    colHeaders,
    ...expRows,
    [emptyCell(), emptyCell(), emptyCell()],
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return {
    ws: finalizeSheet(ws, [35, 22, 55], HEADER_ROW_COUNT, true, HEADER_ROW_COUNT),
    rowCount: expRows.length,
  };
}

/**
 * Sheet 4: Goal Leaderboard
 */
async function buildGoalLeaderboardSheet({ dateStart, dateEnd, officeFilter, officeLabel, generatedAt, generatedBy, userRole }) {
  const activeOffices = resolveOfficeIds(officeFilter);
  const officeIds = activeOffices.length > 0 ? activeOffices : Object.keys(OFFICE_MAP);

  const months = [];
  const startYear = parseInt(dateStart.slice(0, 4), 10);
  const startMonth = parseInt(dateStart.slice(5, 7), 10);
  const endYear = parseInt(dateEnd.slice(0, 4), 10);
  const endMonth = parseInt(dateEnd.slice(5, 7), 10);
  for (let yr = startYear; yr <= endYear; yr++) {
    const mStart = yr === startYear ? startMonth : 1;
    const mEnd = yr === endYear ? endMonth : 12;
    for (let m = mStart; m <= mEnd; m++) {
      months.push(`${yr}-${String(m).padStart(2, '0')}`);
    }
  }

  const monthsToFetch = months.slice(0, 12);
  const rawRows = [];

  await Promise.allSettled(
    officeIds.flatMap(officeId =>
      monthsToFetch.map(async (monthYear) => {
        try {
          const data = await getGoalAchievement(officeId, monthYear);
          const officeName = OFFICE_MAP[officeId]?.name || officeId;
          rawRows.push({
            office: officeName,
            month: monthYear,
            target: data?.target ?? null,
            collected: data?.collected ?? null,
            met: data?.target > 0 && data?.collected != null
              ? (data.collected >= data.target ? 'Yes' : 'No') : NA,
          });
        } catch { /* skip */ }
      })
    )
  );

  if (rawRows.length === 0) {
    rawRows.push({ office: NA, month: NA, target: null, collected: null, met: NA });
  }

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Goal Leaderboard',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const colHeaders = [
    tableHeaderCell('Office'),
    tableHeaderCell('Month'),
    tableHeaderCell('Goal Target'),
    tableHeaderCell('Actual Collections'),
    tableHeaderCell('Achievement %'),
    tableHeaderCell('Goal Met'),
    tableHeaderCell('Source'),
  ];

  const dataRows = rawRows.map((d, i) => [
    dataCell(d.office, i),
    dataCell(d.month, i),
    dataCell(fmtCurrency(d.target), i),
    dataCell(fmtCurrency(d.collected), i),
    dataCell(d.target > 0 && d.collected != null ? fmtPct((d.collected / d.target) * 100) : NA, i),
    dataCell(d.met, i),
    dataCell('office_goals (Supabase) + Dentrix/FastAPI collections', i),
  ]);

  const footer = buildConfidentialFooter(7);

  const allRows = [
    ...headerRows,
    colHeaders,
    ...dataRows,
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return {
    ws: finalizeSheet(ws, [22, 12, 18, 20, 16, 10, 45], HEADER_ROW_COUNT, true, HEADER_ROW_COUNT),
    rowCount: dataRows.length,
  };
}

/**
 * Sheet 5: Period Comparison
 */
async function buildPeriodComparisonSheet({ dateStart, dateEnd, locationId, officeIds, officeLabel, generatedAt, generatedBy, userRole }) {
  const startMs = new Date(dateStart).getTime();
  const endMs = new Date(dateEnd).getTime();
  const midMs = Math.floor((startMs + endMs) / 2);
  const midDate = format(new Date(midMs), 'yyyy-MM-dd');

  const periodAStart = dateStart;
  const periodAEnd = midDate;
  const periodBStart = format(new Date(midMs + 86400000), 'yyyy-MM-dd');
  const periodBEnd = dateEnd;

  let aData = null, bData = null;
  try {
    const [aProd, aColl, aExp, bProd, bColl, bExp] = await Promise.allSettled([
      ascendApi.getProduction(periodAStart, periodAEnd, locationId),
      ascendApi.getCollections(periodAStart, periodAEnd, locationId),
      fetchExpenseKPIs({ startDate: periodAStart, endDate: periodAEnd, officeIds }),
      ascendApi.getProduction(periodBStart, periodBEnd, locationId),
      ascendApi.getCollections(periodBStart, periodBEnd, locationId),
      fetchExpenseKPIs({ startDate: periodBStart, endDate: periodBEnd, officeIds }),
    ]);

    const extractProd = (r) => r.status === 'fulfilled' ? r.value : null;
    const aP = extractProd(aProd), aC = extractProd(aColl), aE = extractProd(aExp);
    const bP = extractProd(bProd), bC = extractProd(bColl), bE = extractProd(bExp);

    const aNetProd = aP?.netProduction ?? aP?.net_production ?? null;
    const bNetProd = bP?.netProduction ?? bP?.net_production ?? null;
    const aTotalColl = aC?.totalCollections ?? aC?.total_collections ?? null;
    const bTotalColl = bC?.totalCollections ?? bC?.total_collections ?? null;
    const aTotalExp = aE?.totalExpenses ?? null;
    const bTotalExp = bE?.totalExpenses ?? null;

    const aCollRate = (aNetProd && aTotalColl) ? (aTotalColl / aNetProd) * 100 : null;
    const bCollRate = (bNetProd && bTotalColl) ? (bTotalColl / bNetProd) * 100 : null;
    const aNetProfit = (aTotalColl != null && aTotalExp != null) ? aTotalColl - aTotalExp : null;
    const bNetProfit = (bTotalColl != null && bTotalExp != null) ? bTotalColl - bTotalExp : null;
    const aMargin = (aTotalColl && aNetProfit != null) ? (aNetProfit / aTotalColl) * 100 : null;
    const bMargin = (bTotalColl && bNetProfit != null) ? (bNetProfit / bTotalColl) * 100 : null;

    aData = { netProd: aNetProd, totalColl: aTotalColl, totalExp: aTotalExp, collRate: aCollRate, netProfit: aNetProfit, margin: aMargin };
    bData = { netProd: bNetProd, totalColl: bTotalColl, totalExp: bTotalExp, collRate: bCollRate, netProfit: bNetProfit, margin: bMargin };
  } catch (err) {
    console.warn('[fullWorkbookService] Period Comparison fetch failed:', err?.message);
  }

  const varDollar = (a, b) => (a != null && b != null) ? fmtCurrency(b - a) : NA;
  const varPct = (a, b) => (a != null && b != null && a !== 0) ? `${(((b - a) / Math.abs(a)) * 100).toFixed(1)}%` : NA;

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Period Comparison',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const colHeaders = [
    tableHeaderCell('Metric'),
    tableHeaderCell(`Period A (${periodAStart} → ${periodAEnd})`),
    tableHeaderCell(`Period B (${periodBStart} → ${periodBEnd})`),
    tableHeaderCell('Variance ($)'),
    tableHeaderCell('Variance (%)'),
    tableHeaderCell('Performance'),
  ];

  const buildRow = (label, aVal, bVal, isExpense = false, i = 0) => {
    const vd = (aVal != null && bVal != null) ? bVal - aVal : null;
    const favorable = vd != null ? (isExpense ? vd < 0 : vd > 0) : null;
    return [
      dataCell(label, i),
      dataCell(fmtCurrency(aVal), i),
      dataCell(fmtCurrency(bVal), i),
      dataCell(varDollar(aVal, bVal), i),
      dataCell(varPct(aVal, bVal), i),
      dataCell(favorable != null ? (favorable ? '✓ Favorable' : '✗ Unfavorable') : NA, i),
    ];
  };

  const compRows = [
    buildRow('Net Production', aData?.netProd, bData?.netProd, false, 0),
    buildRow('Total Collections', aData?.totalColl, bData?.totalColl, false, 1),
    buildRow('Total Expenses', aData?.totalExp, bData?.totalExp, true, 0),
    buildRow('Net Profit', aData?.netProfit, bData?.netProfit, false, 1),
    [
      dataCell('Collection Rate', 0),
      dataCell(fmtPct(aData?.collRate), 0),
      dataCell(fmtPct(bData?.collRate), 0),
      dataCell((aData?.collRate != null && bData?.collRate != null) ? `${(bData.collRate - aData.collRate).toFixed(1)} pp` : NA, 0),
      dataCell(NA, 0),
      dataCell((aData?.collRate != null && bData?.collRate != null) ? (bData.collRate > aData.collRate ? '✓ Favorable' : '✗ Unfavorable') : NA, 0),
    ],
    [
      dataCell('Net Margin %', 1),
      dataCell(fmtPct(aData?.margin), 1),
      dataCell(fmtPct(bData?.margin), 1),
      dataCell((aData?.margin != null && bData?.margin != null) ? `${(bData.margin - aData.margin).toFixed(1)} pp` : NA, 1),
      dataCell(NA, 1),
      dataCell((aData?.margin != null && bData?.margin != null) ? (bData.margin > aData.margin ? '✓ Favorable' : '✗ Unfavorable') : NA, 1),
    ],
  ];

  const footer = buildConfidentialFooter(6);

  const allRows = [
    ...headerRows,
    colHeaders,
    ...compRows,
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return {
    ws: finalizeSheet(ws, [22, 28, 28, 16, 14, 16], HEADER_ROW_COUNT, false),
    rowCount: compRows.length,
  };
}

/**
 * Sheet 6: Provider Production & Collections
 */
async function buildProviderSheet({ dateStart, dateEnd, locationId, officeLabel, generatedAt, generatedBy, userRole }) {
  let providers = [];
  try {
    const data = await ascendApi.getProviderPerformance(dateStart, dateEnd, locationId);
    providers = data?.providers ?? data?.data ?? (Array.isArray(data) ? data : []);
  } catch (err) {
    console.warn('[fullWorkbookService] Provider Performance fetch failed:', err?.message);
  }

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Provider Production & Collections',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const colHeaders = [
    tableHeaderCell('Provider'),
    tableHeaderCell('Office'),
    tableHeaderCell('Provider Type'),
    tableHeaderCell('Gross Production'),
    tableHeaderCell('Adjustments'),
    tableHeaderCell('Net Production'),
    tableHeaderCell('Patient Collections'),
    tableHeaderCell('Insurance Collections'),
    tableHeaderCell('Total Collections'),
    tableHeaderCell('Collection Rate'),
    tableHeaderCell('Source'),
  ];

  const dataRows = providers.map((p, i) => {
    const grossProd = p?.grossProduction ?? p?.gross_production ?? null;
    const adj = p?.adjustments ?? null;
    const netProd = p?.netProduction ?? p?.net_production ?? null;
    const patColl = p?.patientCollections ?? p?.patient_collections ?? null;
    const insColl = p?.insuranceCollections ?? p?.insurance_collections ?? null;
    const totalColl = p?.totalCollections ?? p?.total_collections ?? null;
    const collRate = (netProd && totalColl) ? (totalColl / netProd) * 100 : null;

    return [
      dataCell(p?.providerName ?? p?.provider_name ?? p?.name ?? NA, i),
      dataCell(p?.officeName ?? p?.office_name ?? p?.office ?? NA, i),
      dataCell(p?.providerType ?? p?.provider_type ?? p?.specialty ?? NA, i),
      dataCell(fmtCurrency(grossProd), i),
      dataCell(fmtCurrency(adj), i),
      dataCell(fmtCurrency(netProd), i),
      dataCell(fmtCurrency(patColl), i),
      dataCell(fmtCurrency(insColl), i),
      dataCell(fmtCurrency(totalColl), i),
      dataCell(fmtPct(collRate), i),
      dataCell('Dentrix/FastAPI /v2/reports/provider-performance', i),
    ];
  });

  if (dataRows.length === 0) {
    dataRows.push([
      dataCell(NA, 0), dataCell(NA, 0), dataCell(NA, 0), dataCell(NA, 0), dataCell(NA, 0),
      dataCell(NA, 0), dataCell(NA, 0), dataCell(NA, 0), dataCell(NA, 0), dataCell(NA, 0),
      dataCell('No provider data returned for selected period', 0),
    ]);
  }

  const footer = buildConfidentialFooter(11);

  const allRows = [
    ...headerRows,
    colHeaders,
    ...dataRows,
    Array(11).fill(emptyCell()),
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return {
    ws: finalizeSheet(ws, [24, 18, 16, 18, 16, 18, 20, 22, 18, 16, 40], HEADER_ROW_COUNT, true, HEADER_ROW_COUNT),
    rowCount: dataRows.length,
  };
}

/**
 * Sheet 7: Office Comparison
 */
async function buildOfficeComparisonSheet({ dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole }) {
  const officeIds = Object.keys(OFFICE_MAP);
  const officeResults = [];

  await Promise.allSettled(
    officeIds.map(async (officeId) => {
      const locationId = getLocationIdByOfficeId(officeId);
      const officeName = OFFICE_MAP[officeId]?.name || officeId;
      try {
        const [collResult, expResult] = await Promise.allSettled([
          ascendApi.getCollections(dateStart, dateEnd, locationId),
          fetchExpenseKPIs({ startDate: dateStart, endDate: dateEnd, officeIds: [officeId] }),
        ]);

        const coll = collResult.status === 'fulfilled' ? collResult.value : null;
        const exp = expResult.status === 'fulfilled' ? expResult.value : null;

        const totalColl = coll?.totalCollections ?? coll?.total_collections ?? null;
        const totalExp = exp?.totalExpenses ?? null;
        const netProfit = (totalColl != null && totalExp != null) ? totalColl - totalExp : null;
        const margin = (totalColl && netProfit != null) ? (netProfit / totalColl) * 100 : null;

        officeResults.push({ officeName, totalColl, totalExp, netProfit, margin });
      } catch {
        officeResults.push({ officeName, totalColl: null, totalExp: null, netProfit: null, margin: null });
      }
    })
  );

  let corporateExp = null;
  try {
    const allExp = await fetchExpenseKPIs({ startDate: dateStart, endDate: dateEnd, officeIds: [] });
    const sumOfficeExp = officeResults.reduce((sum, o) => sum + (o.totalExp ?? 0), 0);
    const allTotal = allExp?.totalExpenses ?? null;
    corporateExp = allTotal != null ? Math.max(0, allTotal - sumOfficeExp) : null;
  } catch { /* ignore */ }

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Office Comparison',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const colHeaders = [
    tableHeaderCell('Office'),
    tableHeaderCell('Total Collections'),
    tableHeaderCell('Total Expenses'),
    tableHeaderCell('Net Profit'),
    tableHeaderCell('Profit Margin %'),
    tableHeaderCell('Note'),
  ];

  const dataRows = officeResults.map((o, i) => [
    dataCell(o.officeName, i),
    dataCell(fmtCurrency(o.totalColl), i),
    dataCell(fmtCurrency(o.totalExp), i),
    dataCell(fmtCurrency(o.netProfit), i),
    dataCell(fmtPct(o.margin), i),
    dataCell('', i),
  ]);

  dataRows.push([
    totalCell('Corporate / Shared Expense'),
    totalCell(NA),
    totalCell(fmtCurrency(corporateExp)),
    totalCell(NA),
    totalCell(NA),
    totalCell('Not ranked as an office — company-level shared expenses'),
  ]);

  const footer = buildConfidentialFooter(6);

  const allRows = [
    ...headerRows,
    colHeaders,
    ...dataRows,
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return {
    ws: finalizeSheet(ws, [26, 20, 18, 16, 16, 40], HEADER_ROW_COUNT, true, HEADER_ROW_COUNT),
    rowCount: dataRows.length,
  };
}

/**
 * Sheet 8: Treatment Plan Completion
 */
async function buildTreatmentPlanSheet({ dateStart, dateEnd, officeFilter, officeLabel, generatedAt, generatedBy, userRole }) {
  let tpData = null;
  try {
    const activeOffices = resolveOfficeIds(officeFilter);
    const params = {
      plannedStartDate: dateStart,
      plannedEndDate: dateEnd,
      completionWindowDays: COMPLETION_WINDOW_DAYS,
      includeOpen: true,
      includeSameDay: false,
    };
    if (activeOffices.length === 1) {
      params.officeId = activeOffices[0];
    } else {
      params.allOffices = true;
    }
    tpData = await fetchTreatmentPlanCompletion(params);
  } catch (err) {
    console.warn('[fullWorkbookService] Treatment Plan Completion fetch failed:', err?.message);
  }

  const summary = tpData?.summary ?? tpData ?? null;
  const byOffice = tpData?.by_office ?? tpData?.byOffice ?? [];
  const byProvider = tpData?.by_provider ?? tpData?.byProvider ?? tpData?.by_planning_provider ?? [];

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Treatment Plan Completion',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const summaryRows = [
    [sectionHeaderCell('TREATMENT PLAN COMPLETION SUMMARY'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    [metaLabelCell('Source'), metaValueCell('Dentrix/FastAPI /v2/eod/treatment-plan-completion'), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('Completion Window'), metaValueCell(`${COMPLETION_WINDOW_DAYS} days`), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('Note'), metaValueCell('Treatment-planned procedures only. Direct/walk-in completed procedures excluded.'), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [tableHeaderCell('Metric'), tableHeaderCell('Value'), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Completion Rate by Value', 0), dataCell(fmtPct(summary?.completionRateByValue ?? summary?.completion_rate_by_value ?? null), 0), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Completion Rate by Count', 1), dataCell(fmtPct(summary?.completionRateByCount ?? summary?.completion_rate_by_count ?? null), 1), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Planned Value', 0), dataCell(fmtCurrency(summary?.plannedValue ?? summary?.planned_value ?? null), 0), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Completed Value', 1), dataCell(fmtCurrency(summary?.completedValue ?? summary?.completed_value ?? null), 1), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Open Value', 0), dataCell(fmtCurrency(summary?.openValue ?? summary?.open_value ?? null), 0), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Unscheduled Value', 1), dataCell(fmtCurrency(summary?.unscheduledValue ?? summary?.unscheduled_value ?? null), 1), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Scheduled Not Completed', 0), dataCell(fmtCurrency(summary?.scheduledNotCompleted ?? summary?.scheduled_not_completed ?? null), 0), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Avg Days to Completion', 1), dataCell(fmtDays(summary?.avgDaysToCompletion ?? summary?.avg_days_to_completion ?? null), 1), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [dataCell('Median Days to Completion', 0), dataCell(fmtDays(summary?.medianDaysToCompletion ?? summary?.median_days_to_completion ?? null), 0), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];

  const officeRows = [];
  if (byOffice.length > 0) {
    officeRows.push([sectionHeaderCell('BY OFFICE'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')]);
    officeRows.push([
      tableHeaderCell('Office'),
      tableHeaderCell('Completion Rate (Value)'),
      tableHeaderCell('Completion Rate (Count)'),
      tableHeaderCell('Planned Value'),
      tableHeaderCell('Completed Value'),
      tableHeaderCell('Open Value'),
    ]);
    for (const [i, o] of byOffice.entries()) {
      officeRows.push([
        dataCell(o?.officeName ?? o?.office_name ?? o?.office ?? NA, i),
        dataCell(fmtPct(o?.completionRateByValue ?? o?.completion_rate_by_value ?? null), i),
        dataCell(fmtPct(o?.completionRateByCount ?? o?.completion_rate_by_count ?? null), i),
        dataCell(fmtCurrency(o?.plannedValue ?? o?.planned_value ?? null), i),
        dataCell(fmtCurrency(o?.completedValue ?? o?.completed_value ?? null), i),
        dataCell(fmtCurrency(o?.openValue ?? o?.open_value ?? null), i),
      ]);
    }
    officeRows.push([emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()]);
  }

  const providerRows = [];
  if (byProvider.length > 0) {
    providerRows.push([sectionHeaderCell('BY PLANNING PROVIDER'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')]);
    providerRows.push([
      tableHeaderCell('Provider'),
      tableHeaderCell('Completion Rate (Value)'),
      tableHeaderCell('Completion Rate (Count)'),
      tableHeaderCell('Planned Value'),
      tableHeaderCell('Completed Value'),
      emptyCell(),
    ]);
    for (const [i, p] of byProvider.entries()) {
      providerRows.push([
        dataCell(p?.providerName ?? p?.provider_name ?? p?.provider ?? NA, i),
        dataCell(fmtPct(p?.completionRateByValue ?? p?.completion_rate_by_value ?? null), i),
        dataCell(fmtPct(p?.completionRateByCount ?? p?.completion_rate_by_count ?? null), i),
        dataCell(fmtCurrency(p?.plannedValue ?? p?.planned_value ?? null), i),
        dataCell(fmtCurrency(p?.completedValue ?? p?.completed_value ?? null), i),
        emptyCell(),
      ]);
    }
  }

  const footer = buildConfidentialFooter(6);

  const allRows = [
    ...headerRows,
    ...summaryRows,
    ...officeRows,
    ...providerRows,
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return {
    ws: finalizeSheet(ws, [30, 22, 22, 18, 18, 18], HEADER_ROW_COUNT, false),
    rowCount: summaryRows.length + officeRows.length + providerRows.length,
  };
}

/**
 * Sheet 9: Patient Flow
 * Source: ascendApi.getPatients → /v2/patients/summary
 *         ascendApi.getAppointmentsSummary → /v2/appointments/summary
 * No daily_entries. No MEA. No manual/EOD. phi_flag=false.
 */
async function buildPatientFlowSheet({ dateStart, dateEnd, officeFilter, officeLabel, generatedAt, generatedBy, userRole }) {
  const activeOfficeIds = resolveOfficeIds(officeFilter);
  const isAll = activeOfficeIds.length === 0;
  const officeEntries = isAll
    ? [{ officeId: null, locationId: null, officeName: 'All Offices' }]
    : activeOfficeIds.map(id => ({
        officeId: id,
        locationId: getLocationIdByOfficeId(id) || null,
        officeName: OFFICE_MAP[id]?.name || id,
      }));

  const pick = (obj, ...keys) => {
    for (const k of keys) {
      if (obj?.[k] !== null && obj?.[k] !== undefined) return Number(obj[k]);
    }
    return null;
  };

  const nullSafeSum = (values) => {
    const valid = (values || []).filter(v => v !== null && v !== undefined);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0);
  };

  const officeRows = [];

  await Promise.allSettled(
    officeEntries.map(async ({ locationId, officeName }) => {
      const [patResult, apptResult] = await Promise.allSettled([
        ascendApi.getPatients(dateStart, dateEnd, locationId),
        ascendApi.getAppointmentsSummary(dateStart, dateEnd, locationId),
      ]);

      const pat = patResult.status === 'fulfilled' ? patResult.value : null;
      const appt = apptResult.status === 'fulfilled' ? apptResult.value : null;

      const newPatients = pick(pat, 'newPatients', 'new_patients');
      const activePatients = pick(pat, 'activePatients', 'uniquePatients', 'active_patients', 'unique_patients');
      const totalScheduled = pick(appt, 'totalScheduled', 'total_scheduled', 'scheduled');
      const completed = pick(appt, 'completed', 'completedAppointments', 'completed_appointments');
      const noShows = pick(appt, 'noShow', 'noShows', 'no_shows');
      const cancelled = pick(appt, 'cancelled', 'cancelledAppointments', 'cancelled_appointments');
      const broken = pick(appt, 'broken', 'brokenAppointments', 'broken_appointments');

      let showRate = null;
      if (completed !== null && totalScheduled !== null && totalScheduled > 0) {
        showRate = (completed / totalScheduled) * 100;
      }

      let missedRate = null;
      const missedCount = nullSafeSum([cancelled, broken, noShows]);
      if (missedCount !== null && totalScheduled !== null && totalScheduled > 0) {
        missedRate = (missedCount / totalScheduled) * 100;
      }

      officeRows.push({ officeName, newPatients, activePatients, totalScheduled, completed, noShows, cancelled, broken, showRate, missedRate });
    })
  );

  if (officeRows.length === 0) {
    officeRows.push({ officeName: NA, newPatients: null, activePatients: null, totalScheduled: null, completed: null, noShows: null, cancelled: null, broken: null, showRate: null, missedRate: null });
  }

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Patient Flow',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const sourceInfoRows = [
    [sectionHeaderCell('SOURCE INFORMATION'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    [metaLabelCell('Patient data'), metaValueCell('Dentrix/FastAPI /v2/patients/summary via ascendApi.getPatients'), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('Appointment data'), metaValueCell('Dentrix/FastAPI /v2/appointments/summary via ascendApi.getAppointmentsSummary'), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('daily_entries used'), metaValueCell('No — manual/EOD source eliminated'), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('PHI included'), metaValueCell('No — aggregate counts only'), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('Show Rate'), metaValueCell('Derived: Completed ÷ Total Scheduled'), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [metaLabelCell('Missed Rate'), metaValueCell('Derived: (Cancelled + Broken + No-Shows) ÷ Total Scheduled'), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];

  const colHeaders = [
    tableHeaderCell('Office'),
    tableHeaderCell('New Patients'),
    tableHeaderCell('Active / Unique Patients'),
    tableHeaderCell('Total Scheduled'),
    tableHeaderCell('Completed'),
    tableHeaderCell('No-Shows'),
    tableHeaderCell('Cancelled'),
    tableHeaderCell('Broken'),
    tableHeaderCell('Show Rate %'),
    tableHeaderCell('Missed Rate %'),
  ];

  const dataRows = officeRows.map((d, i) => [
    dataCell(d.officeName, i),
    dataCell(fmtNum(d.newPatients), i),
    dataCell(fmtNum(d.activePatients), i),
    dataCell(fmtNum(d.totalScheduled), i),
    dataCell(fmtNum(d.completed), i),
    dataCell(fmtNum(d.noShows), i),
    dataCell(fmtNum(d.cancelled), i),
    dataCell(fmtNum(d.broken), i),
    dataCell(fmtPct(d.showRate), i),
    dataCell(fmtPct(d.missedRate), i),
  ]);

  const footer = buildConfidentialFooter(10);

  // The data table starts after headerRows + sourceInfoRows
  const dataTableStartRow = HEADER_ROW_COUNT + sourceInfoRows.length;

  const allRows = [
    ...headerRows,
    ...sourceInfoRows,
    colHeaders,
    ...dataRows,
    Array(10).fill(emptyCell()),
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return {
    ws: finalizeSheet(ws, [22, 14, 22, 16, 14, 12, 12, 12, 14, 14], HEADER_ROW_COUNT, true, dataTableStartRow),
    rowCount: dataRows.length,
  };
}

/**
 * Sheet 10: Source Notes / Audit Metadata
 */
function buildSourceNotesSheet({ dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole, sheetsExported, rowCounts }) {
  const genAtFormatted = generatedAt
    ? new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : NA;

  const headerRows = buildBrandedHeader({
    sheetTitle: 'Source Notes / Audit Metadata',
    dateStart, dateEnd, officeLabel, generatedAt, generatedBy, userRole,
  });

  const metaRows = [
    [sectionHeaderCell('AUDIT METADATA'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    [metaLabelCell('generated_at'), metaValueCell(genAtFormatted), emptyCell(), emptyCell()],
    [metaLabelCell('generated_by'), metaValueCell(generatedBy || NA), emptyCell(), emptyCell()],
    [metaLabelCell('user_role'), metaValueCell(userRole || NA), emptyCell(), emptyCell()],
    [metaLabelCell('report_type'), metaValueCell('full_workbook'), emptyCell(), emptyCell()],
    [metaLabelCell('export_format'), metaValueCell('xlsx'), emptyCell(), emptyCell()],
    [metaLabelCell('source_version'), metaValueCell(SOURCE_VERSION), emptyCell(), emptyCell()],
    [metaLabelCell('date_range_start'), metaValueCell(dateStart), emptyCell(), emptyCell()],
    [metaLabelCell('date_range_end'), metaValueCell(dateEnd), emptyCell(), emptyCell()],
    [metaLabelCell('office_filter'), metaValueCell(officeLabel), emptyCell(), emptyCell()],
    [metaLabelCell('phi_flag'), metaValueCell('false'), emptyCell(), emptyCell()],
    [metaLabelCell('sheets_exported'), metaValueCell(sheetsExported.join(', ')), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];

  const rowCountRows = [
    [sectionHeaderCell('ROW COUNTS BY SHEET'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    ...Object.entries(rowCounts).map(([sheet, count]) => [
      metaLabelCell(sheet),
      metaValueCell(String(count)),
      emptyCell(),
      emptyCell(),
    ]),
    [emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];

  const sourceRows = [
    [sectionHeaderCell('DATA SOURCES BY SHEET'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    [metaLabelCell('Executive Summary / Cover'), metaValueCell('Dentrix/FastAPI /v2/production/summary + /v2/collections/summary + Finance Expense Report fetchExpenseKPIs'), emptyCell(), emptyCell()],
    [metaLabelCell('P&L Summary'), metaValueCell('Dentrix/FastAPI monthly production + collections + Finance Expense Report expense totals'), emptyCell(), emptyCell()],
    [metaLabelCell('Expense Breakdown'), metaValueCell('Finance Expense Report protected summary buckets — fetchExpenseKPIs'), emptyCell(), emptyCell()],
    [metaLabelCell('Goal Leaderboard'), metaValueCell('office_goals (Supabase) + Dentrix/FastAPI collections via getGoalAchievement()'), emptyCell(), emptyCell()],
    [metaLabelCell('Period Comparison'), metaValueCell('Dentrix/FastAPI production + collections + Finance Expense Report expenses'), emptyCell(), emptyCell()],
    [metaLabelCell('Provider Production & Collections'), metaValueCell('Dentrix/FastAPI /v2/reports/provider-performance'), emptyCell(), emptyCell()],
    [metaLabelCell('Office Comparison'), metaValueCell('Dentrix/FastAPI /v2/collections/summary (per office) + Finance Expense Report (office-scoped)'), emptyCell(), emptyCell()],
    [metaLabelCell('Treatment Plan Completion'), metaValueCell('Dentrix/FastAPI /v2/eod/treatment-plan-completion — treatment-planned procedures only'), emptyCell(), emptyCell()],
    [metaLabelCell('Patient Flow'), metaValueCell('Patient Flow uses Dentrix/FastAPI patient and appointment summaries; no daily_entries/manual source. Sources: /v2/patients/summary (new/active patients) + /v2/appointments/summary (scheduled, completed, no-shows, cancelled, broken).'), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];

  const exclusionRows = [
    [sectionHeaderCell('KNOWN EXCLUSIONS / LIMITATIONS'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    [metaLabelCell('Patient-level PHI'), metaValueCell('Not included — aggregate-only workbook'), emptyCell(), emptyCell()],
    [metaLabelCell('MEA / monthly_executive_analytics'), metaValueCell('Not used as official source'), emptyCell(), emptyCell()],
    [metaLabelCell('daily_entries / revenue_entries'), metaValueCell('Not used as official source'), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];

  const securityRows = [
    [sectionHeaderCell('SECURITY'), sectionHeaderCell(''), sectionHeaderCell(''), sectionHeaderCell('')],
    [metaLabelCell('Audit logged to'), metaValueCell('report_export_audit_log (Supabase RLS — authenticated user session only)'), emptyCell(), emptyCell()],
    [metaLabelCell('Service role key used'), metaValueCell('No — authenticated user JWT only'), emptyCell(), emptyCell()],
    [metaLabelCell('PHI included'), metaValueCell('No — aggregate-only'), emptyCell(), emptyCell()],
    [emptyCell(), emptyCell(), emptyCell(), emptyCell()],
  ];

  const footer = buildConfidentialFooter(4);

  const allRows = [
    ...headerRows,
    ...metaRows,
    ...rowCountRows,
    ...sourceRows,
    ...exclusionRows,
    ...securityRows,
    ...footer,
  ];

  const ws = aoaToStyledSheet(allRows);
  return finalizeSheet(ws, [35, 80, 20, 20], HEADER_ROW_COUNT, false);
}

// ── Audit log insert ──────────────────────────────────────────────────────────

export async function insertExportAuditLog({
  userId,
  userEmail,
  userRole,
  dateStart,
  dateEnd,
  officeFilter,
  officeLabel,
  sheetsExported,
  rowCounts,
  filename,
}) {
  const payload = {
    user_id: userId,
    user_email: userEmail,
    user_role: userRole,
    report_type: 'full_workbook',
    export_format: 'xlsx',
    date_range_start: dateStart,
    date_range_end: dateEnd,
    office_filter: officeFilter || ['all'],
    sheets_exported: sheetsExported,
    row_counts: rowCounts,
    phi_flag: false,
    source_version: SOURCE_VERSION,
    source_notes: 'Dentrix/FastAPI + Finance Expense Report protected source; aggregate-only workbook',
    metadata: {
      office_label: officeLabel,
      workbook_filename: filename,
      app_environment: import.meta.env?.MODE || 'production',
      report_filters: {
        date_range_start: dateStart,
        date_range_end: dateEnd,
        office_filter: officeFilter,
      },
    },
  };

  const { error } = await supabase
    .from('report_export_audit_log')
    .insert(payload);

  if (error) {
    throw new Error(`Audit log insert failed: ${error.message}`);
  }

  return { success: true };
}

// ── Main export function ──────────────────────────────────────────────────────

/**
 * Generate and download the Full Workbook XLSX.
 *
 * Flow:
 *   1. Resolve date range and office params
 *   2. Fetch all sheet data in parallel
 *   3. Build XLSX workbook
 *   4. Insert audit log (MUST succeed before download)
 *   5. Trigger file download
 *
 * @param {object} params
 * @param {string} params.dateFilter        Reports date filter preset
 * @param {string[]} params.officeFilter    Array of office UUIDs or ['all']
 * @param {object} params.userProfile       { id, email, role }
 * @param {number|null} params.netProduction  From Reports KPI cards
 * @param {number|null} params.totalCollections From Reports KPI cards
 * @param {number|null} params.totalExpenses  From Reports KPI cards
 * @param {function} params.onProgress      Optional progress callback (message: string)
 * @returns {Promise<{ success: boolean, filename: string }>}
 */
export async function generateFullWorkbook({
  dateFilter,
  officeFilter,
  userProfile,
  netProduction = null,
  totalCollections = null,
  totalExpenses = null,
  onProgress = null,
}) {
  const { start: dateStart, end: dateEnd } = resolveReportDateRange(dateFilter);
  const locationId = resolveLocationId(officeFilter);
  const officeIds = resolveOfficeIds(officeFilter);
  const officeLabel = resolveOfficeLabel(officeFilter);
  const generatedAt = new Date().toISOString();
  const generatedBy = userProfile?.email || NA;
  const userRole = userProfile?.role || NA;

  // Shared branding context passed to every sheet builder
  const brandCtx = { officeLabel, generatedAt, generatedBy, userRole };

  onProgress?.('Fetching report data…');

  // ── Fetch all sheets in parallel ──────────────────────────────────────────
  const [
    plResult,
    expResult,
    goalResult,
    periodResult,
    providerResult,
    officeResult,
    tpResult,
    patientFlowResult,
  ] = await Promise.allSettled([
    buildPLSummarySheet({ dateStart, dateEnd, locationId, officeIds, ...brandCtx }),
    buildExpenseBreakdownSheet({ dateStart, dateEnd, officeIds, ...brandCtx }),
    buildGoalLeaderboardSheet({ dateStart, dateEnd, officeFilter, ...brandCtx }),
    buildPeriodComparisonSheet({ dateStart, dateEnd, locationId, officeIds, ...brandCtx }),
    buildProviderSheet({ dateStart, dateEnd, locationId, ...brandCtx }),
    buildOfficeComparisonSheet({ dateStart, dateEnd, ...brandCtx }),
    buildTreatmentPlanSheet({ dateStart, dateEnd, officeFilter, ...brandCtx }),
    buildPatientFlowSheet({ dateStart, dateEnd, officeFilter, ...brandCtx }),
  ]);

  onProgress?.('Building workbook…');

  // ── Collect row counts ────────────────────────────────────────────────────
  const rowCounts = {
    'Executive Summary': 1,
    'P&L Summary': plResult.status === 'fulfilled' ? plResult.value.rowCount : 0,
    'Expense Breakdown': expResult.status === 'fulfilled' ? expResult.value.rowCount : 0,
    'Goal Leaderboard': goalResult.status === 'fulfilled' ? goalResult.value.rowCount : 0,
    'Period Comparison': periodResult.status === 'fulfilled' ? periodResult.value.rowCount : 0,
    'Provider Production': providerResult.status === 'fulfilled' ? providerResult.value.rowCount : 0,
    'Office Comparison': officeResult.status === 'fulfilled' ? officeResult.value.rowCount : 0,
    'Treatment Plan Completion': tpResult.status === 'fulfilled' ? tpResult.value.rowCount : 0,
    'Patient Flow': patientFlowResult.status === 'fulfilled' ? patientFlowResult.value.rowCount : 0,
    'Source Notes': 1,
  };

  const sheetsExported = [
    'Executive Summary / Cover',
    'P&L Summary',
    'Expense Breakdown',
    'Goal Leaderboard',
    'Period Comparison',
    'Provider Production & Collections',
    'Office Comparison',
    'Treatment Plan Completion',
    'Patient Flow',
    'Source Notes / Audit Metadata',
  ];

  // ── Build filename ────────────────────────────────────────────────────────
  const officeSanitized = sanitizeFilename(officeLabel);
  const filename = `nu_reports_full_workbook_${dateStart}_${dateEnd}_${officeSanitized}.xlsx`;

  // ── Insert audit log FIRST — block download if it fails ──────────────────
  onProgress?.('Writing audit log…');

  await insertExportAuditLog({
    userId: userProfile?.id,
    userEmail: userProfile?.email,
    userRole: userProfile?.role,
    dateStart,
    dateEnd,
    officeFilter,
    officeLabel,
    sheetsExported,
    rowCounts,
    filename,
  });

  // ── Build XLSX workbook ───────────────────────────────────────────────────
  onProgress?.('Generating XLSX file…');

  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const execSheet = buildExecutiveSummarySheet({
    netProduction,
    totalCollections,
    totalExpenses,
    dateStart,
    dateEnd,
    ...brandCtx,
  });
  XLSX.utils.book_append_sheet(wb, execSheet, 'Executive Summary');

  // Sheet 2: P&L Summary
  const plSheet = plResult.status === 'fulfilled' ? plResult.value.ws : XLSX.utils.aoa_to_sheet([['Data unavailable']]);
  XLSX.utils.book_append_sheet(wb, plSheet, 'P&L Summary');

  // Sheet 3: Expense Breakdown
  const expSheet = expResult.status === 'fulfilled' ? expResult.value.ws : XLSX.utils.aoa_to_sheet([['Data unavailable']]);
  XLSX.utils.book_append_sheet(wb, expSheet, 'Expense Breakdown');

  // Sheet 4: Goal Leaderboard
  const goalSheet = goalResult.status === 'fulfilled' ? goalResult.value.ws : XLSX.utils.aoa_to_sheet([['Data unavailable']]);
  XLSX.utils.book_append_sheet(wb, goalSheet, 'Goal Leaderboard');

  // Sheet 5: Period Comparison
  const periodSheet = periodResult.status === 'fulfilled' ? periodResult.value.ws : XLSX.utils.aoa_to_sheet([['Data unavailable']]);
  XLSX.utils.book_append_sheet(wb, periodSheet, 'Period Comparison');

  // Sheet 6: Provider Production & Collections
  const providerSheet = providerResult.status === 'fulfilled' ? providerResult.value.ws : XLSX.utils.aoa_to_sheet([['Data unavailable']]);
  XLSX.utils.book_append_sheet(wb, providerSheet, 'Provider Production');

  // Sheet 7: Office Comparison
  const officeSheet = officeResult.status === 'fulfilled' ? officeResult.value.ws : XLSX.utils.aoa_to_sheet([['Data unavailable']]);
  XLSX.utils.book_append_sheet(wb, officeSheet, 'Office Comparison');

  // Sheet 8: Treatment Plan Completion
  const tpSheet = tpResult.status === 'fulfilled' ? tpResult.value.ws : XLSX.utils.aoa_to_sheet([['Data unavailable']]);
  XLSX.utils.book_append_sheet(wb, tpSheet, 'Treatment Plan Completion');

  // Sheet 9: Patient Flow
  const patientFlowSheet = patientFlowResult.status === 'fulfilled' ? patientFlowResult.value.ws : XLSX.utils.aoa_to_sheet([['Data unavailable']]);
  XLSX.utils.book_append_sheet(wb, patientFlowSheet, 'Patient Flow');

  // Sheet 10: Source Notes
  const sourceSheet = buildSourceNotesSheet({
    dateStart,
    dateEnd,
    ...brandCtx,
    sheetsExported,
    rowCounts,
  });
  XLSX.utils.book_append_sheet(wb, sourceSheet, 'Source Notes');

  // ── Trigger download ──────────────────────────────────────────────────────
  onProgress?.('Downloading…');
  XLSX.writeFile(wb, filename);

  return { success: true, filename };
}
