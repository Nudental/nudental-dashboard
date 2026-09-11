import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import StatusBadge from './StatusBadge';

const REPORT_TYPES = [
  { id: 'by_office', label: 'Usage by Office', icon: 'Building2' },
  { id: 'by_provider', label: 'Usage by Provider', icon: 'User' },
  { id: 'by_date', label: 'Usage by Date Range', icon: 'Calendar' },
  { id: 'by_type', label: 'Usage by Product Type', icon: 'Package' },
  { id: 'expiration', label: 'Expiration Report', icon: 'AlertTriangle' },
  { id: 'missing_id', label: 'Missing ID Number Report', icon: 'AlertCircle' },
];

const groupBy = (arr, key) => {
  return arr?.reduce((acc, item) => {
    const k = item?.[key] || 'Unknown';
    if (!acc?.[k]) acc[k] = [];
    acc?.[k]?.push(item);
    return acc;
  }, {});
};

const ReportsTab = ({ records }) => {
  const [activeReport, setActiveReport] = useState('by_office');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const today = new Date();

  const filteredByDate = records?.filter(r => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(r.procedure_date);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo)) return false;
    return true;
  });

  const getReportData = () => {
    switch (activeReport) {
      case 'by_office': return groupBy(filteredByDate, 'office_name');
      case 'by_provider': return groupBy(filteredByDate, 'provider_name');
      case 'by_date': return groupBy(filteredByDate, 'procedure_date');
      case 'by_type': return groupBy(filteredByDate, 'bone_tissue_type');
      case 'expiration':
        return {
          'Expired': records?.filter(r => r?.expiration_date && new Date(r.expiration_date) < today),
          'Expiring 30 days': records?.filter(r => {
            if (!r?.expiration_date) return false;
            const d = new Date(r.expiration_date);
            const in30 = new Date(today); in30?.setDate(today?.getDate() + 30);
            return d >= today && d <= in30;
          }),
          'Expiring 60 days': records?.filter(r => {
            if (!r?.expiration_date) return false;
            const d = new Date(r.expiration_date);
            const in30 = new Date(today); in30?.setDate(today?.getDate() + 30);
            const in60 = new Date(today); in60?.setDate(today?.getDate() + 60);
            return d > in30 && d <= in60;
          }),
        };
      case 'missing_id':
        return { 'Missing Identification Number': records?.filter(r => !r?.identification_number?.trim()) };
      default: return {};
    }
  };

  const reportData = getReportData();

  const exportCSV = () => {
    const headers = ['Date', 'Location', 'Provider', 'Patient', 'Type', 'Product', 'ID Number', 'Lot Number', 'Expiration', 'Staff', 'Status', 'Qty'];
    const rows = filteredByDate?.map(r => [
      r?.procedure_date, r?.office_name, r?.provider_name, r?.patient_name,
      r?.bone_tissue_type, r?.product_name, r?.identification_number,
      r?.lot_number, r?.expiration_date, r?.staff_assistant_name, r?.item_status, r?.quantity_used,
    ]);
    const csv = [headers, ...rows]?.map(row => row?.map(v => `"${v || ''}"`)?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bone-tissue-inventory-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  const exportPrint = () => {
    const reportLabel = REPORT_TYPES?.find(rt => rt?.id === activeReport)?.label || activeReport;
    const generatedAt = new Date()?.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    const filterInfo = [
      dateFrom ? `From: ${dateFrom}` : null,
      dateTo ? `To: ${dateTo}` : null,
    ]?.filter(Boolean)?.join('  |  ') || 'All dates';

    const groupsHtml = Object.entries(reportData)?.map(([group, items]) => {
      const rowsHtml = items?.length === 0
        ? `<tr><td colspan="5" style="text-align:center;padding:12px;color:#6b7280;">No records</td></tr>`
        : items?.map(item => `
            <tr>
              <td>${item?.procedure_date || '—'}</td>
              <td>${item?.product_name || '—'}</td>
              <td style="font-family:monospace;">${item?.identification_number || '<span style="color:#ef4444;">Missing</span>'}</td>
              <td>${item?.patient_name || '—'}</td>
              <td>${item?.item_status || '—'}</td>
            </tr>`)?.join('');
      return `
        <div class="group-block">
          <div class="group-header">
            <span>${group}</span>
            <span>${items?.length} record${items?.length !== 1 ? 's' : ''}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Product</th><th>ID Number</th><th>Patient</th><th>Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    })?.join('');

    const noDataHtml = Object.keys(reportData)?.length === 0
      ? `<p style="text-align:center;color:#6b7280;padding:32px 0;">No data for selected filters</p>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Nu Dental — ${reportLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #111827; background: #fff; padding: 32px; }
    .report-header { border-bottom: 2px solid #1d4ed8; padding-bottom: 16px; margin-bottom: 20px; }
    .report-header h1 { font-size: 20px; font-weight: 700; color: #1d4ed8; }
    .report-header .subtitle { font-size: 13px; color: #374151; margin-top: 2px; }
    .meta-row { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 20px; font-size: 11px; color: #6b7280; }
    .meta-row span strong { color: #111827; }
    .group-block { margin-bottom: 20px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .group-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead tr { background: #f9fafb; }
    th { padding: 6px 10px; text-align: left; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e5e7eb; }
    td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 16px; }
      .group-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>Nu Dental — Inventory Report</h1>
    <div class="subtitle">${reportLabel}</div>
  </div>
  <div class="meta-row">
    <span><strong>Report:</strong> ${reportLabel}</span>
    <span><strong>Date Filter:</strong> ${filterInfo}</span>
    <span><strong>Generated:</strong> ${generatedAt}</span>
    <span><strong>Module:</strong> Bone &amp; Tissue Inventory</span>
  </div>
  ${groupsHtml}
  ${noDataHtml}
  <div class="footer">CONFIDENTIAL — Nu Dental Internal Use Only — Unauthorized distribution is prohibited</div>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win?.document?.write(html);
    win?.document?.close();
    win?.focus();
    win?.print();
  };

  const exportExcel = () => {
    const headers = ['Date', 'Location', 'Provider', 'Patient', 'Type', 'Product', 'ID Number', 'Lot Number', 'Expiration', 'Staff', 'Status', 'Qty'];
    const rows = filteredByDate?.map(r => [
      r?.procedure_date, r?.office_name, r?.provider_name, r?.patient_name,
      r?.bone_tissue_type, r?.product_name, r?.identification_number,
      r?.lot_number, r?.expiration_date, r?.staff_assistant_name, r?.item_status, r?.quantity_used,
    ]);
    const tsv = [headers, ...rows]?.map(row => row?.map(v => v || '')?.join('\t'))?.join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bone-tissue-inventory-${new Date()?.toISOString()?.split('T')?.[0]}.xls`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Export Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">Export:</span>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Icon name="FileText" size={14} />
          CSV
        </button>
        <button
          onClick={exportPrint}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Icon name="Printer" size={14} />
          PDF / Print
        </button>
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Icon name="Table" size={14} />
          Excel
        </button>
      </div>
      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Date range:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e?.target?.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-muted-foreground">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e?.target?.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-muted-foreground hover:text-destructive underline"
          >
            Clear
          </button>
        )}
      </div>
      {/* Report Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {REPORT_TYPES?.map(rt => (
          <button
            key={rt?.id}
            onClick={() => setActiveReport(rt?.id)}
            className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition-all ${
              activeReport === rt?.id
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            <Icon name={rt?.icon} size={16} />
            <span className="text-center leading-tight">{rt?.label}</span>
          </button>
        ))}
      </div>
      {/* Report Data */}
      <div className="space-y-4">
        {Object.entries(reportData)?.map(([group, items]) => (
          <div key={group} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
              <span className="font-semibold text-sm text-foreground">{group}</span>
              <span className="text-xs text-muted-foreground">{items?.length} record{items?.length !== 1 ? 's' : ''}</span>
            </div>
            {items?.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No records</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Product</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">ID Number</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Patient</th>
                      <th className="px-3 py-2 text-left text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items?.map(item => (
                      <tr key={item?.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2">{item?.procedure_date}</td>
                        <td className="px-3 py-2">{item?.product_name}</td>
                        <td className="px-3 py-2 font-mono">{item?.identification_number || <span className="text-red-500">Missing</span>}</td>
                        <td className="px-3 py-2">{item?.patient_name}</td>
                        <td className="px-3 py-2"><StatusBadge status={item?.item_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {Object.keys(reportData)?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="FileBarChart" size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No data for selected report</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsTab;
