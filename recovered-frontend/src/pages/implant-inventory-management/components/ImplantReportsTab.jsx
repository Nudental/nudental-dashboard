import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import ImplantStatusBadge from './ImplantStatusBadge';

const COLORS = ['#1E40AF', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'];

const REPORT_TYPES = [
  { id: 'by_office', label: 'Usage by Office', icon: 'Building2' },
  { id: 'by_provider', label: 'Usage by Provider', icon: 'User' },
  { id: 'by_company', label: 'Usage by Company', icon: 'Package' },
  { id: 'by_platform', label: 'Usage by Platform Size', icon: 'Layers' },
  { id: 'by_length', label: 'Usage by Length', icon: 'Ruler' },
  { id: 'low_stock', label: 'Low Stock Report', icon: 'PackageX' },
  { id: 'expiration', label: 'Expiration Report', icon: 'AlertTriangle' },
  { id: 'missing_id', label: 'Missing ID Number', icon: 'AlertCircle' },
  { id: 'audit', label: 'Audit History', icon: 'History' },
];

const groupBy = (arr, key) => arr?.reduce((acc, item) => {
  const k = item?.[key] || 'Unknown';
  if (!acc?.[k]) acc[k] = [];
  acc?.[k]?.push(item);
  return acc;
}, {});

const ImplantReportsTab = ({ inventoryRecords, usageRecords, offices }) => {
  const [activeReport, setActiveReport] = useState('by_office');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [officeFilter, setOfficeFilter] = useState('');

  const today = new Date();
  const in30 = new Date(today); in30?.setDate(today?.getDate() + 30);
  const in60 = new Date(today); in60?.setDate(today?.getDate() + 60);
  const in90 = new Date(today); in90?.setDate(today?.getDate() + 90);

  const filteredUsage = usageRecords?.filter(r => {
    if (officeFilter && r?.office_id !== officeFilter) return false;
    if (dateFrom && r?.procedure_date < dateFrom) return false;
    if (dateTo && r?.procedure_date > dateTo) return false;
    return true;
  });

  const filteredInventory = inventoryRecords?.filter(r => {
    if (officeFilter && r?.office_id !== officeFilter) return false;
    return true;
  });

  const getReportData = () => {
    switch (activeReport) {
      case 'by_office': return groupBy(filteredUsage, 'office_name');
      case 'by_provider': return groupBy(filteredUsage, 'provider_name');
      case 'by_company': return groupBy(filteredUsage, 'company_name');
      case 'by_platform': return groupBy(filteredUsage, 'platform_size_name');
      case 'by_length': return groupBy(filteredUsage, 'length_label');
      case 'low_stock':
        return { 'Low Stock Items': filteredInventory?.filter(r => (r?.quantity_in_stock || 0) <= (r?.minimum_stock_level || 2)) };
      case 'expiration':
        return {
          'Expired': filteredInventory?.filter(r => r?.expiration_date && new Date(r?.expiration_date) < today),
          'Expiring 30 days': filteredInventory?.filter(r => r?.expiration_date && new Date(r?.expiration_date) >= today && new Date(r?.expiration_date) <= in30),
          'Expiring 60 days': filteredInventory?.filter(r => r?.expiration_date && new Date(r?.expiration_date) > in30 && new Date(r?.expiration_date) <= in60),
          'Expiring 90 days': filteredInventory?.filter(r => r?.expiration_date && new Date(r?.expiration_date) > in60 && new Date(r?.expiration_date) <= in90),
        };
      case 'missing_id':
        return { 'Missing Identification Number': filteredInventory?.filter(r => !r?.identification_number?.trim()) };
      default: return {};
    }
  };

  const reportData = getReportData();

  const chartData = Object.entries(reportData)?.map(([k, v]) => ({ name: k?.replace('Nu Dental of ', ''), count: v?.length }));

  const exportCSV = () => {
    const isUsageReport = activeReport?.startsWith('by_');
    const headers = isUsageReport
      ? ['Date', 'Location', 'Provider', 'Patient', 'Company', 'System', 'Platform', 'Length', 'Diameter', 'ID Number', 'Lot #', 'Status']
      : ['Location', 'Company', 'System', 'Platform', 'Length', 'ID Number', 'Qty', 'Expiration', 'Status'];
    const rows = Object.values(reportData)?.flat()?.map(r => isUsageReport ? [
      r?.procedure_date, r?.office_name, r?.provider_name, r?.patient_name,
      r?.company_name, r?.system_name, r?.platform_size_name, r?.length_label,
      r?.diameter_label, r?.identification_number, r?.lot_number, r?.item_status,
    ] : [
      r?.office_name, r?.company_name, r?.system_name, r?.platform_size_name,
      r?.length_label, r?.identification_number, r?.quantity_in_stock,
      r?.expiration_date, r?.item_status,
    ]);
    const csv = [headers, ...rows]?.map(row => row?.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `implant-${activeReport}-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
    a?.click(); URL.revokeObjectURL(url);
  };

  const exportPrint = () => {
    const reportLabel = REPORT_TYPES?.find(rt => rt?.id === activeReport)?.label || activeReport;
    const generatedAt = new Date()?.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    const selectedOfficeName = officeFilter
      ? (offices?.find(o => o?.id === officeFilter)?.name || officeFilter)
      : 'All Locations';
    const filterInfo = [
      `Location: ${selectedOfficeName}`,
      dateFrom ? `From: ${dateFrom}` : null,
      dateTo ? `To: ${dateTo}` : null,
    ]?.filter(Boolean)?.join('  |  ');

    const isUsageReport = activeReport?.startsWith('by_') && !['low_stock', 'expiration', 'missing_id']?.includes(activeReport);

    const groupsHtml = Object.entries(reportData)?.map(([groupName, rows]) => {
      const rowsHtml = rows?.length === 0
        ? `<tr><td colspan="9" style="text-align:center;padding:12px;color:#6b7280;">No records</td></tr>`
        : rows?.map(r => isUsageReport
            ? `<tr>
                <td>${r?.procedure_date || '—'}</td>
                <td>${r?.provider_name || '—'}</td>
                <td>${r?.patient_name || '—'}</td>
                <td>${r?.company_name || '—'}</td>
                <td>${r?.system_name || '—'}</td>
                <td style="font-family:monospace;">${r?.identification_number || '—'}</td>
                <td>${r?.item_status || '—'}</td>
              </tr>`
            : `<tr>
                <td>${r?.office_name?.replace('Nu Dental of ', '') || '—'}</td>
                <td>${r?.company_name || '—'}</td>
                <td>${r?.system_name || '—'}</td>
                <td>${r?.platform_size_name || '—'}</td>
                <td>${r?.length_label || '—'}</td>
                <td style="font-family:monospace;">${r?.identification_number || '—'}</td>
                <td>${r?.quantity_in_stock ?? '—'}</td>
                <td>${r?.expiration_date || '—'}</td>
                <td>${r?.item_status || '—'}</td>
              </tr>`
          )?.join('');

      const theadHtml = isUsageReport
        ? `<tr><th>Date</th><th>Provider</th><th>Patient</th><th>Company</th><th>System</th><th>ID Number</th><th>Status</th></tr>`
        : `<tr><th>Location</th><th>Company</th><th>System</th><th>Platform</th><th>Length</th><th>ID Number</th><th>Qty</th><th>Expiration</th><th>Status</th></tr>`;

      return `
        <div class="group-block">
          <div class="group-header">
            <span>${groupName}</span>
            <span>${rows?.length} record${rows?.length !== 1 ? 's' : ''}</span>
          </div>
          <table>
            <thead>${theadHtml}</thead>
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
    <span><strong>Filters:</strong> ${filterInfo}</span>
    <span><strong>Generated:</strong> ${generatedAt}</span>
    <span><strong>Module:</strong> Implant Inventory</span>
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

  const showChart = ['by_office', 'by_provider', 'by_company', 'by_platform', 'by_length']?.includes(activeReport);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select value={officeFilter} onChange={e => setOfficeFilter(e?.target?.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="">All Locations</option>
          {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e?.target?.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-background" title="From" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e?.target?.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-background" title="To" />
        <div className="flex gap-2 ml-auto">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors">
            <Icon name="Download" size={13} /> CSV
          </button>
          <button onClick={exportPrint} className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors">
            <Icon name="Printer" size={13} /> Print
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Report type sidebar */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {REPORT_TYPES?.map(rt => (
              <button
                key={rt?.id}
                onClick={() => setActiveReport(rt?.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition-colors border-b border-border last:border-0 ${
                  activeReport === rt?.id ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted'
                }`}
              >
                <Icon name={rt?.icon} size={13} />
                {rt?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report content */}
        <div className="flex-1 min-w-0">
          {/* Chart */}
          {showChart && chartData?.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-4">
              {activeReport === 'by_company' ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={chartData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, count }) => `${name}: ${count}`}>
                      {chartData?.map((_, i) => <Cell key={i} fill={COLORS?.[i % COLORS?.length]} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Data tables */}
          {Object.entries(reportData)?.map(([groupName, rows]) => (
            <div key={groupName} className="bg-card border border-border rounded-xl overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                <span className="font-semibold text-foreground text-sm">{groupName}</span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{rows?.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {activeReport?.startsWith('by_') && !['low_stock', 'expiration', 'missing_id']?.includes(activeReport) ? (
                        ['Date','Provider','Patient','Company','System','ID Number','Status']?.map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)
                      ) : (
                        ['Location','Company','System','Platform','Length','ID Number','Qty','Expiration','Status']?.map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows?.length === 0 ? (
                      <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">No records</td></tr>
                    ) : rows?.slice(0, 50)?.map(r => (
                      <tr key={r?.id} className="hover:bg-muted/20">
                        {activeReport?.startsWith('by_') && !['low_stock', 'expiration', 'missing_id']?.includes(activeReport) ? (
                          <>
                            <td className="px-3 py-2">{r?.procedure_date || '—'}</td>
                            <td className="px-3 py-2">{r?.provider_name || '—'}</td>
                            <td className="px-3 py-2">{r?.patient_name || '—'}</td>
                            <td className="px-3 py-2">{r?.company_name || '—'}</td>
                            <td className="px-3 py-2">{r?.system_name || '—'}</td>
                            <td className="px-3 py-2 font-mono">{r?.identification_number || '—'}</td>
                            <td className="px-3 py-2"><ImplantStatusBadge status={r?.item_status} /></td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2">{r?.office_name?.replace('Nu Dental of ', '') || '—'}</td>
                            <td className="px-3 py-2">{r?.company_name || '—'}</td>
                            <td className="px-3 py-2">{r?.system_name || '—'}</td>
                            <td className="px-3 py-2">{r?.platform_size_name || '—'}</td>
                            <td className="px-3 py-2">{r?.length_label || '—'}</td>
                            <td className="px-3 py-2 font-mono">{r?.identification_number || '—'}</td>
                            <td className="px-3 py-2">{r?.quantity_in_stock ?? '—'}</td>
                            <td className="px-3 py-2">{r?.expiration_date || '—'}</td>
                            <td className="px-3 py-2"><ImplantStatusBadge status={r?.item_status} /></td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {Object.keys(reportData)?.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Icon name="FileBarChart" size={40} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">No data for selected filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImplantReportsTab;
