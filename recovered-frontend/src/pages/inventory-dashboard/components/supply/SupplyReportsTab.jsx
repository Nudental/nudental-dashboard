import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../../../components/AppIcon';
import supplyRequestService from '../../../../services/supplyRequestService';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns { monthStart: "YYYY-MM-DD", monthEnd: "YYYY-MM-DD" } using local-time
 *  integer Date constructor to avoid UTC-shift bugs (same pattern as SupplyOverviewTab). */
function getMonthBounds(yyyyMM) {
  if (!yyyyMM || !/^\d{4}-\d{2}$/?.test(yyyyMM)) return { monthStart: '', monthEnd: '' };
  const [y, m] = yyyyMM?.split('-')?.map(Number);
  const lastDay = new Date(y, m, 0)?.getDate(); // day 0 of next month = last day of this month
  const pad = n => String(n)?.padStart(2, '0');
  return {
    monthStart: `${y}-${pad(m)}-01`,
    monthEnd: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d?.getTime())) return v;
  return d?.toLocaleDateString();
}

function fmtCurrency(v) {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return `$${n?.toFixed(2)}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { value: 'supply_requests_by_office',    label: 'Clinical Supply Requests by Office' },
  { value: 'fulfillment_spend_by_office',  label: 'Clinical Supply Fulfillment Spend by Office' },
  { value: 'vendor_fulfillment_spend',     label: 'Vendor Fulfillment Spend' },
  { value: 'department_fulfillment_spend', label: 'Department Fulfillment Spend' },
  { value: 'top_items_by_cost',            label: 'Top Items by Fulfillment Cost' },
  { value: 'rows_missing_cost',            label: 'Rows Missing Cost' },
  { value: 'pending_requests',             label: 'Pending Clinical Supply Requests' },
];

// Column definitions per report type
const COLUMNS = {
  supply_requests_by_office: [
    { key: 'office_id',      label: 'Office' },
    { key: 'request_month',  label: 'Month',     render: v => v ? v?.slice(0, 7) : '—' },
    { key: 'batch_status',   label: 'Status',    render: v => <span className="capitalize">{v?.replace(/_/g, ' ') ?? '—'}</span> },
    { key: 'submitted_at',   label: 'Submitted', render: v => fmtDate(v) },
  ],
  fulfillment_spend_by_office: [
    { key: 'office_id',     label: 'Office' },
    { key: 'date_supplied', label: 'Date Supplied', render: v => fmtDate(v) },
    { key: 'item_name',     label: 'Item' },
    { key: 'qty_supplied',  label: 'Qty Supplied' },
    { key: 'vendor_name',   label: 'Vendor',    render: (v, row) => row?.supply_vendors?.name ?? v ?? '—' },
    { key: 'total_cost',    label: 'Supply Fulfillment Spend', render: v => fmtCurrency(v) },
  ],
  vendor_fulfillment_spend: [
    { key: 'vendor_name',   label: 'Vendor',    render: (v, row) => row?.supply_vendors?.name ?? v ?? '—' },
    { key: 'office_id',     label: 'Office' },
    { key: 'date_supplied', label: 'Date Supplied', render: v => fmtDate(v) },
    { key: 'item_name',     label: 'Item' },
    { key: 'qty_supplied',  label: 'Qty Supplied' },
    { key: 'total_cost',    label: 'Supply Fulfillment Spend', render: v => fmtCurrency(v) },
  ],
  department_fulfillment_spend: [
    { key: 'department_id', label: 'Department', render: (v, row) => row?.supply_departments?.name ?? v ?? '—' },
    { key: 'office_id',     label: 'Office' },
    { key: 'date_supplied', label: 'Date Supplied', render: v => fmtDate(v) },
    { key: 'item_name',     label: 'Item' },
    { key: 'qty_supplied',  label: 'Qty Supplied' },
    { key: 'total_cost',    label: 'Supply Fulfillment Spend', render: v => fmtCurrency(v) },
  ],
  top_items_by_cost: [
    { key: 'item_name',    label: 'Item' },
    { key: 'office_id',    label: 'Office' },
    { key: 'vendor_name',  label: 'Vendor',    render: (v, row) => row?.supply_vendors?.name ?? v ?? '—' },
    { key: 'qty_supplied', label: 'Qty Supplied' },
    { key: 'total_cost',   label: 'Supply Fulfillment Spend', render: v => fmtCurrency(v) },
  ],
  rows_missing_cost: [
    { key: 'office_id',     label: 'Office' },
    { key: 'date_supplied', label: 'Date Supplied', render: v => fmtDate(v) },
    { key: 'item_name',     label: 'Item' },
    { key: 'qty_supplied',  label: 'Qty Supplied' },
    { key: 'vendor_name',   label: 'Vendor',    render: (v, row) => row?.supply_vendors?.name ?? v ?? '—' },
    { key: 'total_cost',    label: 'Supply Fulfillment Spend', render: () => '—' },
  ],
  pending_requests: [
    { key: 'office_id',     label: 'Office' },
    { key: 'request_month', label: 'Month',     render: v => v ? v?.slice(0, 7) : '—' },
    { key: 'batch_status',  label: 'Status',    render: v => <span className="capitalize">{v?.replace(/_/g, ' ') ?? '—'}</span> },
    { key: 'submitted_at',  label: 'Submitted', render: v => fmtDate(v) },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────

const SupplyReportsTab = ({ isAdmin, isRCM, monthFilter, officeFilterProp }) => {
  const printRef = useRef(null);

  // Derive initial date bounds from page-level monthFilter
  const initBounds = getMonthBounds(monthFilter || new Date()?.toISOString()?.slice(0, 7));

  const [reportType, setReportType]   = useState('supply_requests_by_office');
  const [officeFilter, setOfficeFilter] = useState(
    officeFilterProp && officeFilterProp !== 'All Offices' ? officeFilterProp : ''
  );
  const [dateFrom, setDateFrom] = useState(initBounds?.monthStart);
  const [dateTo,   setDateTo]   = useState(initBounds?.monthEnd);
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const OFFICES = supplyRequestService?.getOffices() || [];

  // When page-level monthFilter changes, update date range to match
  useEffect(() => {
    if (!monthFilter) return;
    const { monthStart, monthEnd } = getMonthBounds(monthFilter);
    setDateFrom(monthStart);
    setDateTo(monthEnd);
  }, [monthFilter]);

  // When page-level officeFilter changes, sync local office filter
  useEffect(() => {
    setOfficeFilter(
      officeFilterProp && officeFilterProp !== 'All Offices' ? officeFilterProp : ''
    );
  }, [officeFilterProp]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let result = [];
      const filters = {
        officeId: officeFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo:   dateTo   || undefined,
      };

      switch (reportType) {
        case 'supply_requests_by_office':
          // Back Staff only, respect date range via request_month bounds
          result = await supplyRequestService?.fetchRequestBatches({
            officeId: officeFilter || undefined,
            departmentCategory: 'Back Staff',
            // dateFrom/dateTo map to request_month — filter client-side after fetch
          });
          // Filter by request_month within selected date range
          if (dateFrom || dateTo) {
            result = result?.filter(r => {
              const rm = r?.request_month ? r?.request_month?.slice(0, 10) : null;
              if (!rm) return true;
              if (dateFrom && rm < dateFrom) return false;
              if (dateTo   && rm > dateTo)   return false;
              return true;
            });
          }
          break;

        case 'fulfillment_spend_by_office':
          result = await supplyRequestService?.fetchFulfillmentLogs(filters);
          break;

        case 'vendor_fulfillment_spend':
          result = await supplyRequestService?.fetchFulfillmentLogs(filters);
          // Sort by vendor name then total_cost desc
          result = [...result]?.sort((a, b) => {
            const va = a?.supply_vendors?.name ?? a?.vendor_name ?? '';
            const vb = b?.supply_vendors?.name ?? b?.vendor_name ?? '';
            if (va < vb) return -1;
            if (va > vb) return 1;
            return (parseFloat(b?.total_cost) || 0) - (parseFloat(a?.total_cost) || 0);
          });
          break;

        case 'department_fulfillment_spend':
          result = await supplyRequestService?.fetchFulfillmentLogs(filters);
          result = [...result]?.sort((a, b) => {
            const da = a?.supply_departments?.name ?? '';
            const db = b?.supply_departments?.name ?? '';
            if (da < db) return -1;
            if (da > db) return 1;
            return 0;
          });
          break;

        case 'top_items_by_cost':
          result = await supplyRequestService?.fetchFulfillmentLogs(filters);
          result = [...result]?.filter(r => r?.total_cost !== null && r?.total_cost !== undefined)?.sort((a, b) => (parseFloat(b?.total_cost) || 0) - (parseFloat(a?.total_cost) || 0));
          break;

        case 'rows_missing_cost':
          result = await supplyRequestService?.fetchFulfillmentLogs(filters);
          result = result?.filter(r => r?.total_cost === null || r?.total_cost === undefined);
          break;

        case 'pending_requests':
          result = await supplyRequestService?.fetchRequestBatches({
            officeId: officeFilter || undefined,
            status: 'submitted',
            departmentCategory: 'Back Staff',
          });
          if (dateFrom || dateTo) {
            result = result?.filter(r => {
              const rm = r?.request_month ? r?.request_month?.slice(0, 10) : null;
              if (!rm) return true;
              if (dateFrom && rm < dateFrom) return false;
              if (dateTo   && rm > dateTo)   return false;
              return true;
            });
          }
          break;

        default:
          result = [];
      }
      setData(result);
    } catch (e) {
      setError(e?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [reportType, officeFilter, dateFrom, dateTo]);

  useEffect(() => { loadReport(); }, [loadReport]);

  // ── CSV export — filtered rows only ────────────────────────────────────────
  const exportCSV = () => {
    if (!data?.length) return;
    const cols = COLUMNS?.[reportType] || [];
    const header = cols?.map(c => `"${c?.label}"`)?.join(',');
    const rows = data?.map(row =>
      cols?.map(c => {
        let val = row?.[c?.key];
        // For vendor/department, resolve nested name
        if (c?.key === 'vendor_name') val = row?.supply_vendors?.name ?? row?.vendor_name ?? '';
        if (c?.key === 'department_id') val = row?.supply_departments?.name ?? row?.department_id ?? '';
        if (val === null || val === undefined) val = '';
        return `"${String(val)?.replace(/"/g, '""')}"`;
      })?.join(',')
    );
    const csv = [header, ...rows]?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_${dateFrom || 'all'}_to_${dateTo || 'all'}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  // ── Print — report content only ────────────────────────────────────────────
  const exportPrint = () => {
    const content = printRef?.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    win?.document?.write(`
      <html><head><title>Clinical Supply Report</title>
      <style>
        body { font-family: sans-serif; font-size: 12px; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        h3 { margin-bottom: 4px; }
        p { margin: 0 0 12px; color: #666; }
      </style></head><body>${content}</body></html>
    `);
    win?.document?.close();
    win?.focus();
    win?.print();
    win?.close();
  };

  // ── Table render ───────────────────────────────────────────────────────────
  const renderTable = () => {
    if (!data?.length) return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
        <Icon name="FileBarChart" size={32} className="mb-2 opacity-30" />
        <p className="text-sm">No data for selected filters</p>
      </div>
    );

    const cols = COLUMNS?.[reportType] || [];

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              {cols?.map(c => (
                <th key={c?.key} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  {c?.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.map((row, idx) => (
              <tr key={idx} className="border-b border-border/50 hover:bg-muted/20">
                {cols?.map(c => (
                  <td key={c?.key} className="py-2.5 px-3 text-sm">
                    {c?.render ? c?.render(row?.[c?.key], row) : (row?.[c?.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const currentLabel = REPORT_TYPES?.find(r => r?.value === reportType)?.label ?? '';

  // Date range label shown to user so they know what period is active
  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom} → ${dateTo}`
    : dateFrom
    ? `From ${dateFrom}`
    : dateTo
    ? `To ${dateTo}`
    : 'All dates';

  return (
    <div className="space-y-4">
      {/* Scope banner */}
      <div className="px-4 py-2.5 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
        Clinical Supply Reports show Back Staff / Clinical requests and supply fulfillment spend only.
        These are not actual clinical consumption records and not Finance P&amp;L.
      </div>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}
      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Report type */}
          <select
            value={reportType}
            onChange={e => setReportType(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
          >
            {REPORT_TYPES?.map(r => (
              <option key={r?.value} value={r?.value}>{r?.label}</option>
            ))}
          </select>

          {/* Office */}
          <select
            value={officeFilter}
            onChange={e => setOfficeFilter(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
          >
            <option value="">All Offices</option>
            {OFFICES?.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          {/* Date from */}
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-muted-foreground px-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e?.target?.value)}
              className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-0.5">
            <label className="text-xs text-muted-foreground px-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e?.target?.value)}
              className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
            />
          </div>
        </div>

        {/* Active date range indicator */}
        <p className="mt-2 text-xs text-muted-foreground">
          Active date range: <span className="font-medium text-foreground">{dateRangeLabel}</span>
          {monthFilter && (
            <button
              onClick={() => {
                const { monthStart, monthEnd } = getMonthBounds(monthFilter);
                setDateFrom(monthStart);
                setDateTo(monthEnd);
              }}
              className="ml-3 text-violet-600 hover:underline"
            >
              Reset to {monthFilter}
            </button>
          )}
        </p>
      </div>
      {/* Report header + actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{currentLabel}</h3>
          <p className="text-xs text-muted-foreground">{data?.length} records · {dateRangeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={!data?.length}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Icon name="Download" size={13} />CSV
          </button>
          <button
            onClick={exportPrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
          >
            <Icon name="Printer" size={13} />Print
          </button>
        </div>
      </div>
      {/* Printable report area */}
      <div ref={printRef}>
        <h3 style={{ display: 'none' }} className="print-title">{currentLabel}</h3>
        <p style={{ display: 'none' }} className="print-range">{dateRangeLabel}</p>

        {/* Report table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : renderTable()}
        </div>
      </div>
    </div>
  );
};

export default SupplyReportsTab;
