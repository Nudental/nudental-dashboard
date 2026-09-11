import { supabase } from '../lib/supabase';
import { fetchMultiYearMEAData, aggregateYearKPIs, buildComparisonKPIRows, calcPctChange,  } from './yearComparisonService';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const BRAND = {
  slate: '#1e293b',
  indigo: '#4f46e5',
  indigoLight: '#e0e7ff',
  emerald: '#059669',
  red: '#dc2626',
  muted: '#64748b',
  border: '#e2e8f0',
  white: '#ffffff',
  bg: '#f8fafc',
  amber: '#d97706',
};

const YEAR_COLORS = ['#6366f1', '#10b981', '#f59e0b'];

const fmtCurrency = (v) =>
  v == null || !isFinite(v) ? 'N/A' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v);

const fmtNum = (v) =>
  v == null || !isFinite(v) ? 'N/A' : new Intl.NumberFormat('en-US')?.format(Math.round(v));

const fmtPct = (v) =>
  v == null ? 'N/A' : `${v > 0 ? '+' : ''}${v}%`;

const fmtVal = (v, format) => {
  if (v == null || !isFinite(v)) return 'N/A';
  if (format === 'currency') return fmtCurrency(v);
  if (format === 'percent') return `${parseFloat(v)?.toFixed(1)}%`;
  return fmtNum(v);
};

/**
 * Fetch provider-level data for selected years from daily_entries
 */
const fetchProviderDataByYears = async (years, officeIds = []) => {
  const result = {};
  await Promise.all(years?.map(async (year) => {
    let query = supabase?.from('daily_entries')?.select('provider_name, production, collection, new_patients, entry_date, office_id')?.gte('entry_date', `${year}-01-01`)?.lte('entry_date', `${year}-12-31`);

    if (officeIds?.length > 0) query = query?.in('office_id', officeIds);

    const { data, error } = await query;
    if (error || !data) { result[year] = []; return; }

    const provMap = {};
    data?.forEach(row => {
      const key = row?.provider_name || 'Unknown';
      if (!provMap?.[key]) provMap[key] = { provider: key, production: 0, collection: 0, newPatients: 0 };
      provMap[key].production += parseFloat(row?.production || 0);
      provMap[key].collection += parseFloat(row?.collection || 0);
      provMap[key].newPatients += parseInt(row?.new_patients || 0);
    });
    result[year] = Object.values(provMap)?.sort((a, b) => b?.production - a?.production);
  }));
  return result;
};

/**
 * Export year comparison data as CSV
 * @param {number[]} selectedYears
 * @param {string[]} officeIds
 * @param {string} reportTitle
 */
export const exportYearComparisonCSV = async (selectedYears, officeIds = [], reportTitle = 'Year Comparison Report') => {
  if (!selectedYears?.length) return;

  const sortedYears = [...selectedYears]?.sort((a, b) => b - a);
  const yearDataMap = await fetchMultiYearMEAData(sortedYears, officeIds);
  const yearKPIMap = {};
  sortedYears?.forEach(y => { yearKPIMap[y] = aggregateYearKPIs(yearDataMap?.[y] || []); });
  const comparisonRows = buildComparisonKPIRows(yearKPIMap);
  const providerDataMap = await fetchProviderDataByYears(sortedYears, officeIds);

  const lines = [];
  const dateGenerated = new Date()?.toLocaleString();

  // ── HEADER ──
  lines?.push(`"${reportTitle}"`);
  lines?.push(`"Generated: ${dateGenerated}"`);
  lines?.push(`"Years: ${sortedYears?.join(', ')}"`);
  lines?.push('');

  // ── SECTION 1: KPI SUMMARY ──
  lines?.push('"=== KPI SUMMARY ==="');
  const kpiHeader = ['Metric', ...sortedYears?.flatMap((y, i) => {
    const cols = [y];
    if (i > 0) cols?.push(`vs ${sortedYears?.[i - 1]}`);
    return cols;
  })];
  lines?.push(kpiHeader?.map(h => `"${h}"`)?.join(','));

  comparisonRows?.forEach(row => {
    const cells = [row?.label];
    sortedYears?.forEach((year, idx) => {
      cells?.push(fmtVal(row?.values?.[year], row?.format));
      if (idx > 0) {
        const pct = row?.changes?.[year];
        cells?.push(pct != null ? fmtPct(pct) : 'N/A');
      }
    });
    lines?.push(cells?.map(c => `"${c}"`)?.join(','));
  });
  lines?.push('');

  // ── SECTION 2: MONTHLY TRENDS ──
  lines?.push('"=== MONTHLY PRODUCTION TRENDS ==="');
  const monthHeader = ['Month', ...sortedYears?.flatMap((y, i) => {
    const cols = [`${y} Production`, `${y} Collections`];
    if (i > 0) cols?.push(`Prod Δ vs ${sortedYears?.[i - 1]}`);
    return cols;
  })];
  lines?.push(monthHeader?.map(h => `"${h}"`)?.join(','));

  MONTH_NAMES?.forEach((month, idx) => {
    const monthNum = idx + 1;
    const cells = [month];
    sortedYears?.forEach((year, yIdx) => {
      const rows = (yearDataMap?.[year] || [])?.filter(r => parseInt(r?.report_month) === monthNum);
      const prod = rows?.reduce((s, r) => s + parseFloat(r?.production_total || 0), 0);
      const coll = rows?.reduce((s, r) => s + parseFloat(r?.collections_total || 0), 0);
      cells?.push(rows?.length > 0 ? fmtCurrency(prod) : 'N/A');
      cells?.push(rows?.length > 0 ? fmtCurrency(coll) : 'N/A');
      if (yIdx > 0) {
        const olderYear = sortedYears?.[yIdx - 1];
        const olderRows = (yearDataMap?.[olderYear] || [])?.filter(r => parseInt(r?.report_month) === monthNum);
        const olderProd = olderRows?.reduce((s, r) => s + parseFloat(r?.production_total || 0), 0);
        const pct = olderRows?.length > 0 && rows?.length > 0 ? calcPctChange(prod, olderProd) : null;
        cells?.push(pct != null ? fmtPct(pct) : 'N/A');
      }
    });
    lines?.push(cells?.map(c => `"${c}"`)?.join(','));
  });
  lines?.push('');

  // ── SECTION 3: PROVIDER BREAKDOWN ──
  lines?.push('"=== PROVIDER BREAKDOWN ==="');
  const allProviders = [...new Set(
    sortedYears.flatMap(y => (providerDataMap[y] || []).map(p => p.provider))
  )]?.filter(p => p && p !== 'Unknown');

  if (allProviders?.length > 0) {
    const provHeader = ['Provider', ...sortedYears?.flatMap((y, i) => {
      const cols = [`${y} Production`, `${y} Collections`];
      if (i > 0) cols?.push(`Prod Δ vs ${sortedYears?.[i - 1]}`);
      return cols;
    })];
    lines?.push(provHeader?.map(h => `"${h}"`)?.join(','));

    allProviders?.forEach(provider => {
      const cells = [provider];
      sortedYears?.forEach((year, yIdx) => {
        const pData = (providerDataMap?.[year] || [])?.find(p => p?.provider === provider);
        cells?.push(pData ? fmtCurrency(pData?.production) : 'N/A');
        cells?.push(pData ? fmtCurrency(pData?.collection) : 'N/A');
        if (yIdx > 0) {
          const olderYear = sortedYears?.[yIdx - 1];
          const olderData = (providerDataMap?.[olderYear] || [])?.find(p => p?.provider === provider);
          const pct = pData && olderData ? calcPctChange(pData?.production, olderData?.production) : null;
          cells?.push(pct != null ? fmtPct(pct) : 'N/A');
        }
      });
      lines?.push(cells?.map(c => `"${c}"`)?.join(','));
    });
    lines?.push('');
  }

  // ── SECTION 4: COMPARATIVE ANALYSIS SUMMARY ──
  lines?.push('"=== COMPARATIVE ANALYSIS SUMMARY ==="');
  sortedYears?.forEach(year => {
    const kpis = yearKPIMap?.[year];
    if (!kpis) { lines?.push(`"${year}: No data available"`); return; }
    lines?.push(`"${year} Summary"`);
    lines?.push(`"Total Production","${fmtCurrency(kpis?.production)}"`);
    lines?.push(`"Total Collections","${fmtCurrency(kpis?.collections)}"`);
    lines?.push(`"Collection Rate","${kpis?.collectionRate != null ? kpis?.collectionRate?.toFixed(1) + '%' : 'N/A'}"`);
    lines?.push(`"New Patients","${fmtNum(kpis?.newPatients)}"`);
    lines?.push(`"Total Expenses","${fmtCurrency(kpis?.expenses)}"`);
    lines?.push(`"Net Income","${fmtCurrency(kpis?.netIncome)}"`);
    lines?.push(`"Case Acceptance","${kpis?.caseAcceptance != null ? kpis?.caseAcceptance?.toFixed(1) + '%' : 'N/A'}"`);
    lines?.push('');
  });

  // Download
  const csvContent = lines?.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `year-comparison-${sortedYears?.join('-')}-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
  document.body?.appendChild(link);
  link?.click();
  document.body?.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export year comparison data as PDF
 * @param {number[]} selectedYears
 * @param {string[]} officeIds
 * @param {string} reportTitle
 */
export const exportYearComparisonPDF = async (selectedYears, officeIds = [], reportTitle = 'Year Comparison Report') => {
  if (!selectedYears?.length) return;

  const { default: jsPDF } = await import('jspdf');

  const sortedYears = [...selectedYears]?.sort((a, b) => b - a);
  const yearDataMap = await fetchMultiYearMEAData(sortedYears, officeIds);
  const yearKPIMap = {};
  sortedYears?.forEach(y => { yearKPIMap[y] = aggregateYearKPIs(yearDataMap?.[y] || []); });
  const comparisonRows = buildComparisonKPIRows(yearKPIMap);
  const providerDataMap = await fetchProviderDataByYears(sortedYears, officeIds);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc?.internal?.pageSize?.getWidth();
  const pageHeight = doc?.internal?.pageSize?.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const dateGenerated = new Date()?.toLocaleString();
  let y = margin;

  const checkPageBreak = (needed = 10) => {
    if (y + needed > pageHeight - 16) {
      drawFooter();
      doc?.addPage();
      y = margin;
    }
  };

  const drawFooter = () => {
    const fy = pageHeight - 8;
    doc?.setDrawColor(BRAND?.border);
    doc?.setLineWidth(0.3);
    doc?.line(margin, fy - 2, pageWidth - margin, fy - 2);
    doc?.setFontSize(7);
    doc?.setFont('helvetica', 'normal');
    doc?.setTextColor(BRAND?.muted);
    doc?.text(
      `NuDental Confidential — Year Comparison Report — Generated ${dateGenerated}`,
      pageWidth / 2, fy + 1, { align: 'center' }
    );
  };

  const drawSectionHeader = (text) => {
    checkPageBreak(12);
    doc?.setFillColor(BRAND?.slate);
    doc?.rect(margin, y, contentWidth, 7, 'F');
    doc?.setTextColor(BRAND?.white);
    doc?.setFontSize(8);
    doc?.setFont('helvetica', 'bold');
    doc?.text(text?.toUpperCase(), margin + 4, y + 5);
    doc?.setTextColor(BRAND?.slate);
    y += 7;
  };

  // ── COVER HEADER ──
  doc?.setFillColor(BRAND?.slate);
  doc?.rect(0, 0, pageWidth, 30, 'F');
  doc?.setTextColor(BRAND?.white);
  doc?.setFontSize(18);
  doc?.setFont('helvetica', 'bold');
  doc?.text('NuDental', margin, 13);
  doc?.setFontSize(8);
  doc?.setFont('helvetica', 'normal');
  doc?.text('MANAGEMENT GROUP', margin, 19);
  doc?.setFontSize(11);
  doc?.setFont('helvetica', 'bold');
  doc?.text(reportTitle, pageWidth - margin, 12, { align: 'right' });
  doc?.setFontSize(9);
  doc?.setFont('helvetica', 'normal');
  doc?.text(`Years: ${sortedYears?.join(' vs ')}`, pageWidth - margin, 18, { align: 'right' });
  doc?.setFontSize(7);
  doc?.text('CONFIDENTIAL — EXECUTIVE USE ONLY', pageWidth - margin, 24, { align: 'right' });
  y = 38;

  // ── SECTION 1: KPI SUMMARY ──
  drawSectionHeader('KPI Summary — Year-over-Year');
  y += 3;

  const kpiColCount = 1 + sortedYears?.length + (sortedYears?.length - 1);
  const metricColW = 52;
  const yearColW = (contentWidth - metricColW) / (kpiColCount - 1);

  // Table header
  doc?.setFillColor(BRAND?.indigoLight);
  doc?.rect(margin, y, contentWidth, 7, 'F');
  doc?.setTextColor(BRAND?.indigo);
  doc?.setFontSize(7);
  doc?.setFont('helvetica', 'bold');
  doc?.text('Metric', margin + 3, y + 4.8);
  let xc = margin + metricColW;
  sortedYears?.forEach((year, idx) => {
    doc?.text(String(year), xc + yearColW / 2, y + 4.8, { align: 'center' });
    xc += yearColW;
    if (idx > 0) {
      doc?.text(`vs ${sortedYears?.[idx - 1]}`, xc + yearColW / 2, y + 4.8, { align: 'center' });
      xc += yearColW;
    }
  });
  y += 7;

  comparisonRows?.slice(0, 15)?.forEach((row, rowIdx) => {
    checkPageBreak(7);
    const bg = rowIdx % 2 === 0 ? BRAND?.white : BRAND?.bg;
    doc?.setFillColor(bg);
    doc?.rect(margin, y, contentWidth, 6.5, 'F');
    doc?.setDrawColor(BRAND?.border);
    doc?.setLineWidth(0.1);
    doc?.line(margin, y + 6.5, margin + contentWidth, y + 6.5);
    doc?.setTextColor(BRAND?.slate);
    doc?.setFontSize(7);
    doc?.setFont('helvetica', 'bold');
    doc?.text(row?.label, margin + 3, y + 4.3);
    xc = margin + metricColW;
    sortedYears?.forEach((year, idx) => {
      doc?.setFont('helvetica', 'normal');
      doc?.text(fmtVal(row?.values?.[year], row?.format), xc + yearColW / 2, y + 4.3, { align: 'center' });
      xc += yearColW;
      if (idx > 0) {
        const pct = row?.changes?.[year];
        const isPos = pct != null && pct > 0;
        const isNeg = pct != null && pct < 0;
        const isGood = row?.higherIsBetter ? isPos : isNeg;
        const isBad = row?.higherIsBetter ? isNeg : isPos;
        doc?.setTextColor(isGood ? BRAND?.emerald : isBad ? BRAND?.red : BRAND?.muted);
        doc?.text(pct != null ? fmtPct(pct) : '—', xc + yearColW / 2, y + 4.3, { align: 'center' });
        doc?.setTextColor(BRAND?.slate);
        xc += yearColW;
      }
    });
    y += 6.5;
  });
  y += 6;

  // ── SECTION 2: MONTHLY TRENDS ──
  drawSectionHeader('Monthly Production & Collections Trends');
  y += 3;

  const mColW = contentWidth / (1 + sortedYears?.length * 2 + Math.max(0, sortedYears?.length - 1));
  const mMetricW = 14;
  const mYearW = (contentWidth - mMetricW) / (sortedYears?.length * 2 + Math.max(0, sortedYears?.length - 1));

  // Month table header
  doc?.setFillColor(BRAND?.indigoLight);
  doc?.rect(margin, y, contentWidth, 7, 'F');
  doc?.setTextColor(BRAND?.indigo);
  doc?.setFontSize(6.5);
  doc?.setFont('helvetica', 'bold');
  doc?.text('Month', margin + 2, y + 4.8);
  xc = margin + mMetricW;
  sortedYears?.forEach((year, idx) => {
    doc?.text(`${year} Prod`, xc + mYearW / 2, y + 4.8, { align: 'center' });
    xc += mYearW;
    doc?.text(`${year} Coll`, xc + mYearW / 2, y + 4.8, { align: 'center' });
    xc += mYearW;
    if (idx > 0) {
      doc?.text('Δ Prod', xc + mYearW / 2, y + 4.8, { align: 'center' });
      xc += mYearW;
    }
  });
  y += 7;

  MONTH_NAMES?.forEach((month, idx) => {
    checkPageBreak(6.5);
    const monthNum = idx + 1;
    const bg = idx % 2 === 0 ? BRAND?.white : BRAND?.bg;
    doc?.setFillColor(bg);
    doc?.rect(margin, y, contentWidth, 6, 'F');
    doc?.setDrawColor(BRAND?.border);
    doc?.setLineWidth(0.1);
    doc?.line(margin, y + 6, margin + contentWidth, y + 6);
    doc?.setTextColor(BRAND?.slate);
    doc?.setFontSize(6.5);
    doc?.setFont('helvetica', 'bold');
    doc?.text(month, margin + 2, y + 4);
    xc = margin + mMetricW;
    sortedYears?.forEach((year, yIdx) => {
      const rows = (yearDataMap?.[year] || [])?.filter(r => parseInt(r?.report_month) === monthNum);
      const prod = rows?.reduce((s, r) => s + parseFloat(r?.production_total || 0), 0);
      const coll = rows?.reduce((s, r) => s + parseFloat(r?.collections_total || 0), 0);
      doc?.setFont('helvetica', 'normal');
      doc?.text(rows?.length > 0 ? fmtCurrency(prod) : '—', xc + mYearW / 2, y + 4, { align: 'center' });
      xc += mYearW;
      doc?.text(rows?.length > 0 ? fmtCurrency(coll) : '—', xc + mYearW / 2, y + 4, { align: 'center' });
      xc += mYearW;
      if (yIdx > 0) {
        const olderYear = sortedYears?.[yIdx - 1];
        const olderRows = (yearDataMap?.[olderYear] || [])?.filter(r => parseInt(r?.report_month) === monthNum);
        const olderProd = olderRows?.reduce((s, r) => s + parseFloat(r?.production_total || 0), 0);
        const pct = rows?.length > 0 && olderRows?.length > 0 ? calcPctChange(prod, olderProd) : null;
        const isPos = pct != null && pct > 0;
        const isNeg = pct != null && pct < 0;
        doc?.setTextColor(isPos ? BRAND?.emerald : isNeg ? BRAND?.red : BRAND?.muted);
        doc?.text(pct != null ? fmtPct(pct) : '—', xc + mYearW / 2, y + 4, { align: 'center' });
        doc?.setTextColor(BRAND?.slate);
        xc += mYearW;
      }
    });
    y += 6;
  });
  y += 6;

  // ── SECTION 3: PROVIDER BREAKDOWN ──
  const allProviders = [...new Set(
    sortedYears.flatMap(yr => (providerDataMap[yr] || []).map(p => p.provider))
  )]?.filter(p => p && p !== 'Unknown');

  if (allProviders?.length > 0) {
    checkPageBreak(20);
    drawSectionHeader('Provider Breakdown — Year-over-Year');
    y += 3;

    const pColCount = 1 + sortedYears?.length * 2 + Math.max(0, sortedYears?.length - 1);
    const pNameW = 48;
    const pValW = (contentWidth - pNameW) / (pColCount - 1);

    doc?.setFillColor(BRAND?.indigoLight);
    doc?.rect(margin, y, contentWidth, 7, 'F');
    doc?.setTextColor(BRAND?.indigo);
    doc?.setFontSize(7);
    doc?.setFont('helvetica', 'bold');
    doc?.text('Provider', margin + 3, y + 4.8);
    xc = margin + pNameW;
    sortedYears?.forEach((year, idx) => {
      doc?.text(`${year} Prod`, xc + pValW / 2, y + 4.8, { align: 'center' });
      xc += pValW;
      doc?.text(`${year} Coll`, xc + pValW / 2, y + 4.8, { align: 'center' });
      xc += pValW;
      if (idx > 0) {
        doc?.text('Δ Prod', xc + pValW / 2, y + 4.8, { align: 'center' });
        xc += pValW;
      }
    });
    y += 7;

    allProviders?.slice(0, 15)?.forEach((provider, pi) => {
      checkPageBreak(6.5);
      const bg = pi % 2 === 0 ? BRAND?.white : BRAND?.bg;
      doc?.setFillColor(bg);
      doc?.rect(margin, y, contentWidth, 6.5, 'F');
      doc?.setDrawColor(BRAND?.border);
      doc?.setLineWidth(0.1);
      doc?.line(margin, y + 6.5, margin + contentWidth, y + 6.5);
      doc?.setTextColor(BRAND?.slate);
      doc?.setFontSize(7);
      doc?.setFont('helvetica', 'bold');
      doc?.text(provider?.length > 22 ? provider?.substring(0, 22) + '…' : provider, margin + 3, y + 4.3);
      xc = margin + pNameW;
      sortedYears?.forEach((year, yIdx) => {
        const pData = (providerDataMap?.[year] || [])?.find(p => p?.provider === provider);
        doc?.setFont('helvetica', 'normal');
        doc?.text(pData ? fmtCurrency(pData?.production) : '—', xc + pValW / 2, y + 4.3, { align: 'center' });
        xc += pValW;
        doc?.text(pData ? fmtCurrency(pData?.collection) : '—', xc + pValW / 2, y + 4.3, { align: 'center' });
        xc += pValW;
        if (yIdx > 0) {
          const olderYear = sortedYears?.[yIdx - 1];
          const olderData = (providerDataMap?.[olderYear] || [])?.find(p => p?.provider === provider);
          const pct = pData && olderData ? calcPctChange(pData?.production, olderData?.production) : null;
          const isPos = pct != null && pct > 0;
          const isNeg = pct != null && pct < 0;
          doc?.setTextColor(isPos ? BRAND?.emerald : isNeg ? BRAND?.red : BRAND?.muted);
          doc?.text(pct != null ? fmtPct(pct) : '—', xc + pValW / 2, y + 4.3, { align: 'center' });
          doc?.setTextColor(BRAND?.slate);
          xc += pValW;
        }
      });
      y += 6.5;
    });
    y += 6;
  }

  // ── SECTION 4: COMPARATIVE ANALYSIS SUMMARY ──
  checkPageBreak(20);
  drawSectionHeader('Comparative Analysis Summary');
  y += 4;

  sortedYears?.forEach((year, idx) => {
    checkPageBreak(55);
    const kpis = yearKPIMap?.[year];
    const color = YEAR_COLORS?.[idx] || BRAND?.indigo;

    doc?.setFillColor(color);
    doc?.rect(margin, y, 3, 40, 'F');
    doc?.setFillColor(BRAND?.bg);
    doc?.rect(margin + 3, y, contentWidth - 3, 40, 'F');
    doc?.setDrawColor(BRAND?.border);
    doc?.setLineWidth(0.2);
    doc?.rect(margin, y, contentWidth, 40);

    doc?.setTextColor(color);
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'bold');
    doc?.text(`${year} Summary`, margin + 8, y + 7);

    if (!kpis) {
      doc?.setTextColor(BRAND?.muted);
      doc?.setFontSize(8);
      doc?.setFont('helvetica', 'italic');
      doc?.text('No data available for this year.', margin + 8, y + 18);
    } else {
      const summaryItems = [
        ['Total Production', fmtCurrency(kpis?.production)],
        ['Total Collections', fmtCurrency(kpis?.collections)],
        ['Collection Rate', kpis?.collectionRate != null ? `${kpis?.collectionRate?.toFixed(1)}%` : 'N/A'],
        ['New Patients', fmtNum(kpis?.newPatients)],
        ['Total Expenses', fmtCurrency(kpis?.expenses)],
        ['Net Income', fmtCurrency(kpis?.netIncome)],
        ['Case Acceptance', kpis?.caseAcceptance != null ? `${kpis?.caseAcceptance?.toFixed(1)}%` : 'N/A'],
        ['Chair Utilization', kpis?.chairUtilization != null ? `${kpis?.chairUtilization?.toFixed(1)}%` : 'N/A'],
      ];
      const colW = contentWidth / 4;
      summaryItems?.forEach((item, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const ix = margin + 8 + col * colW;
        const iy = y + 14 + row * 12;
        doc?.setTextColor(BRAND?.muted);
        doc?.setFontSize(6.5);
        doc?.setFont('helvetica', 'normal');
        doc?.text(item?.[0], ix, iy);
        doc?.setTextColor(BRAND?.slate);
        doc?.setFontSize(8);
        doc?.setFont('helvetica', 'bold');
        doc?.text(item?.[1], ix, iy + 5);
      });

      // YoY change badge
      if (idx > 0) {
        const olderYear = sortedYears?.[idx - 1];
        const olderKpis = yearKPIMap?.[olderYear];
        if (olderKpis) {
          const pct = calcPctChange(kpis?.production, olderKpis?.production);
          if (pct != null) {
            const isPos = pct > 0;
            doc?.setFillColor(isPos ? '#d1fae5' : '#fee2e2');
            doc?.roundedRect(pageWidth - margin - 40, y + 4, 38, 10, 2, 2, 'F');
            doc?.setTextColor(isPos ? BRAND?.emerald : BRAND?.red);
            doc?.setFontSize(8);
            doc?.setFont('helvetica', 'bold');
            doc?.text(
              `${isPos ? '↑' : '↓'} ${fmtPct(pct)} vs ${olderYear}`,
              pageWidth - margin - 21, y + 10.5, { align: 'center' }
            );
          }
        }
      }
    }
    y += 44;
  });

  // ── FOOTER ──
  const totalPages = doc?.internal?.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc?.setPage(p);
    drawFooter();
    doc?.setFontSize(7);
    doc?.setTextColor(BRAND?.muted);
    doc?.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
  }

  doc?.save(`year-comparison-${sortedYears?.join('-')}-${new Date()?.toISOString()?.split('T')?.[0]}.pdf`);
};
