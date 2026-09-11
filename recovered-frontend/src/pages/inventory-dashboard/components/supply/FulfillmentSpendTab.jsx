import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Icon from '../../../../components/AppIcon';
import { supabase } from '../../../../lib/supabase';
import supplyRequestService from '../../../../services/supplyRequestService';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => (n == null ? '—' : `$${Number(n)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fmtNum = (n) => (n == null ? '—' : Number(n)?.toLocaleString());
const dash = (v) => (v == null || v === '' ? '—' : v);

const MONTH_LABELS = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

const isEstimated = (row) => {
  const notes = (row?.tracking_notes || '')?.toLowerCase();
  return notes?.includes('crest') || notes?.includes('oral-b') || notes?.includes('pro-rated') ||
    notes?.includes('prorated') || notes?.includes('estimated') || notes?.includes('bundle');
};

const isMissingCost = (row) => row?.total_cost == null;

// CSV export helper
const exportCSV = (rows, filename) => {
  if (!rows?.length) return;
  const keys = Object.keys(rows?.[0]);
  const header = keys?.join(',');
  const body = rows?.map(r =>
    keys?.map(k => {
      const v = r?.[k] == null ? '' : String(r?.[k]);
      return v?.includes(',') || v?.includes('"') || v?.includes('\n') ? `"${v?.replace(/"/g, '""')}"` : v;
    })?.join(',')
  )?.join('\n');
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a?.click();
  URL.revokeObjectURL(url);
};

// ── main component ────────────────────────────────────────────────────────────
const FulfillmentSpendTab = () => {
  const [rows, setRows] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // filters
  const [filterOffice, setFilterOffice] = useState('');
  const [filterMonthFrom, setFilterMonthFrom] = useState('');
  const [filterMonthTo, setFilterMonthTo] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const OFFICES = supplyRequestService?.getOffices();

  // ── fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [logsRes, vendorsRes, deptsRes] = await Promise.all([
        supabase?.from('supply_fulfillment_logs')?.select(`
            id, office_id, item_name, sku, date_supplied, qty_supplied,
            unit_cost, total_cost, vendor_id, department_id, tracking_notes,
            supply_departments(name),
            supply_vendors:vendor_id(name)
          `)?.order('date_supplied', { ascending: false }),
        supabase?.from('supply_vendors')?.select('id, name')?.eq('is_active', true)?.order('name'),
        supplyRequestService?.fetchDepartments(),
      ]);

      if (logsRes?.error) throw logsRes?.error;
      if (vendorsRes?.error) throw vendorsRes?.error;

      setRows(logsRes?.data || []);
      setVendors(vendorsRes?.data || []);
      setDepartments(deptsRes || []);
    } catch (e) {
      setError(e?.message || 'Failed to load fulfillment spend data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── filtered rows ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows?.filter(r => {
      const month = r?.date_supplied?.slice(0, 7) || '';
      if (filterOffice && r?.office_id !== filterOffice) return false;
      if (filterMonthFrom && month < filterMonthFrom) return false;
      if (filterMonthTo && month > filterMonthTo) return false;
      if (filterVendor && r?.vendor_id !== filterVendor) return false;
      if (filterDept && r?.department_id !== filterDept) return false;
      if (filterSearch) {
        const q = filterSearch?.toLowerCase();
        const match = (r?.item_name || '')?.toLowerCase()?.includes(q) ||
          (r?.sku || '')?.toLowerCase()?.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [rows, filterOffice, filterMonthFrom, filterMonthTo, filterVendor, filterDept, filterSearch]);

  // ── derived data ───────────────────────────────────────────────────────────
  const withCost = useMemo(() => filtered?.filter(r => !isMissingCost(r)), [filtered]);
  const missingCostRows = useMemo(() => filtered?.filter(r => isMissingCost(r)), [filtered]);
  const estimatedRows = useMemo(() => withCost?.filter(r => isEstimated(r)), [withCost]);

  const totalSpend = useMemo(() => withCost?.reduce((s, r) => s + (Number(r?.total_cost) || 0), 0), [withCost]);
  const estimatedSpend = useMemo(() => estimatedRows?.reduce((s, r) => s + (Number(r?.total_cost) || 0), 0), [estimatedRows]);

  // top vendor
  const vendorMap = useMemo(() => {
    const m = {};
    withCost?.forEach(r => {
      const name = r?.supply_vendors?.name || r?.vendor_id || 'Unknown';
      if (!m?.[name]) m[name] = { name, count: 0, spend: 0 };
      m[name].count += r?.qty_supplied || 0;
      m[name].spend += Number(r?.total_cost) || 0;
    });
    return Object.values(m)?.sort((a, b) => b?.spend - a?.spend);
  }, [withCost]);

  const topVendor = vendorMap?.[0];

  // top department
  const deptMap = useMemo(() => {
    const m = {};
    withCost?.forEach(r => {
      const name = r?.supply_departments?.name?.split('/')?.[0]?.trim() || r?.department_id || 'Unknown';
      if (!m?.[name]) m[name] = { name, spend: 0 };
      m[name].spend += Number(r?.total_cost) || 0;
    });
    return Object.values(m)?.sort((a, b) => b?.spend - a?.spend);
  }, [withCost]);

  const topDept = deptMap?.[0];

  // monthly spend by office
  const monthlyByOffice = useMemo(() => {
    const months = new Set();
    const officeMonthMap = {};
    withCost?.forEach(r => {
      const m = r?.date_supplied?.slice(0, 7);
      if (!m) return;
      months?.add(m);
      const office = r?.office_id || 'Unknown';
      if (!officeMonthMap?.[office]) officeMonthMap[office] = {};
      officeMonthMap[office][m] = (officeMonthMap?.[office]?.[m] || 0) + (Number(r?.total_cost) || 0);
    });
    const sortedMonths = Array.from(months)?.sort();
    const officeRows = Object.entries(officeMonthMap)?.map(([office, mMap]) => {
      const total = Object.values(mMap)?.reduce((s, v) => s + v, 0);
      return { office, ...mMap, total };
    })?.sort((a, b) => b?.total - a?.total);
    return { months: sortedMonths, rows: officeRows };
  }, [withCost]);

  // top items by cost
  const topItems = useMemo(() => {
    const m = {};
    withCost?.forEach(r => {
      const key = `${r?.item_name}|${r?.sku || ''}|${r?.department_id || ''}|${r?.vendor_id || ''}`;
      if (!m?.[key]) m[key] = {
        item_name: r?.item_name,
        sku: r?.sku,
        department: r?.supply_departments?.name?.split('/')?.[0]?.trim() || '—',
        vendor: r?.supply_vendors?.name || '—',
        qty: 0,
        total_cost: 0,
      };
      m[key].qty += r?.qty_supplied || 0;
      m[key].total_cost += Number(r?.total_cost) || 0;
    });
    return Object.values(m)?.sort((a, b) => b?.total_cost - a?.total_cost)?.slice(0, 50);
  }, [withCost]);

  // endo file detail (EdgeEndo rows)
  const endoRows = useMemo(() => {
    return withCost?.filter(r => {
      const vendor = (r?.supply_vendors?.name || '')?.toLowerCase();
      const item = (r?.item_name || '')?.toLowerCase();
      return vendor?.includes('edgeendo') || vendor?.includes('edge endo') || item?.includes('endo') || item?.includes('file');
    })?.sort((a, b) => (b?.total_cost || 0) - (a?.total_cost || 0));
  }, [withCost]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    const exportRows = filtered?.map(r => ({
      date_supplied: r?.date_supplied || '',
      office: r?.office_id || '',
      item_name: r?.item_name || '',
      sku: r?.sku || '',
      department: r?.supply_departments?.name || '',
      vendor: r?.supply_vendors?.name || '',
      qty_supplied: r?.qty_supplied ?? '',
      unit_cost: r?.unit_cost ?? '',
      total_cost: r?.total_cost ?? '',
      estimated_prorated: isEstimated(r) ? 'Yes' : 'No',
      missing_cost: isMissingCost(r) ? 'Yes' : 'No',
      tracking_notes: r?.tracking_notes || '',
    }));
    exportCSV(exportRows, `fulfillment_spend_${new Date()?.toISOString()?.slice(0, 10)}.csv`);
  };

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Disclaimer ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <Icon name="Info" size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800 leading-relaxed">
          <strong>Supply Fulfillment Spend — Supplies Delivered to Offices.</strong>{' '}
          This data represents fulfillment cost monitoring for supplies delivered. It is{' '}
          <strong>not</strong> actual clinical consumption, <strong>not</strong> a Finance P&amp;L expense report,
          and <strong>not</strong> an accounting record.
        </p>
      </div>
      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Icon name="Filter" size={14} />Filters
          </h3>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-xl text-xs font-semibold hover:bg-muted transition-colors"
          >
            <Icon name="Download" size={13} />Export CSV
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={filterOffice}
            onChange={e => setFilterOffice(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
          >
            <option value="">All Offices</option>
            {OFFICES?.map(o => <option key={o} value={o}>{o?.split(' ')?.pop()}</option>)}
          </select>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Month From</label>
            <input
              type="month"
              value={filterMonthFrom}
              onChange={e => setFilterMonthFrom(e?.target?.value)}
              className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Month To</label>
            <input
              type="month"
              value={filterMonthTo}
              onChange={e => setFilterMonthTo(e?.target?.value)}
              className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
            />
          </div>
          <select
            value={filterVendor}
            onChange={e => setFilterVendor(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
          >
            <option value="">All Vendors</option>
            {vendors?.map(v => <option key={v?.id} value={v?.id}>{v?.name}</option>)}
          </select>
          <select
            value={filterDept}
            onChange={e => setFilterDept(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments?.map(d => <option key={d?.id} value={d?.id}>{d?.name?.split('/')?.[0]?.trim()}</option>)}
          </select>
          <input
            type="text"
            placeholder="Search item / SKU..."
            value={filterSearch}
            onChange={e => setFilterSearch(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filtered?.length} rows · {withCost?.length} with cost · {missingCostRows?.length} missing cost
        </p>
      </div>
      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Total Fulfillment Spend</p>
          <p className="text-xl font-bold text-foreground">{fmt(totalSpend)}</p>
          <p className="text-xs text-muted-foreground">{withCost?.length} rows with cost</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Rows Missing Cost</p>
          <p className="text-xl font-bold text-orange-600">{missingCostRows?.length}</p>
          <p className="text-xs text-muted-foreground">Excluded from spend totals</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Estimated / Pro-Rated Spend</p>
          <p className="text-xl font-bold text-amber-600">{fmt(estimatedSpend)}</p>
          <p className="text-xs text-muted-foreground">{estimatedRows?.length} rows (Crest+Oral-B bundles)</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Top Vendor</p>
          <p className="text-base font-bold text-foreground truncate">{topVendor?.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{topVendor ? `${fmtNum(topVendor?.count)} items · ${fmt(topVendor?.spend)}` : '—'}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Top Department</p>
          <p className="text-base font-bold text-foreground truncate">{topDept?.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{topDept ? fmt(topDept?.spend) : '—'}</p>
        </div>
      </div>
      {/* ── Monthly Spend by Office ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Monthly Fulfillment Spend by Office</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Supply fulfillment spend — not clinical consumption</p>
        </div>
        {monthlyByOffice?.rows?.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">Office</th>
                  {monthlyByOffice?.months?.map(m => (
                    <th key={m} className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {MONTH_LABELS?.[m?.slice(5, 7)] || m?.slice(5, 7)} {m?.slice(2, 4)}
                    </th>
                  ))}
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyByOffice?.rows?.map(row => (
                  <tr key={row?.office} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 px-4 text-xs font-medium">{row?.office?.split(' ')?.pop() || row?.office}</td>
                    {monthlyByOffice?.months?.map(m => (
                      <td key={m} className="py-2.5 px-3 text-xs text-right">
                        {row?.[m] ? fmt(row?.[m]) : '—'}
                      </td>
                    ))}
                    <td className="py-2.5 px-4 text-xs text-right font-semibold text-foreground">{fmt(row?.total)}</td>
                  </tr>
                ))}
                {/* totals row */}
                <tr className="bg-muted/30 font-semibold">
                  <td className="py-2.5 px-4 text-xs">Total</td>
                  {monthlyByOffice?.months?.map(m => {
                    const colTotal = monthlyByOffice?.rows?.reduce((s, r) => s + (r?.[m] || 0), 0);
                    return <td key={m} className="py-2.5 px-3 text-xs text-right">{colTotal > 0 ? fmt(colTotal) : '—'}</td>;
                  })}
                  <td className="py-2.5 px-4 text-xs text-right">{fmt(totalSpend)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Vendor Spend ────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Vendor Fulfillment Spend</h3>
        </div>
        {vendorMap?.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Vendor', 'Items Supplied', 'Total Spend']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorMap?.map((v, i) => (
                  <tr key={v?.name} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 px-4 text-xs font-medium">{v?.name}</td>
                    <td className="py-2.5 px-4 text-xs">{fmtNum(v?.count)}</td>
                    <td className="py-2.5 px-4 text-xs font-semibold text-emerald-700">{fmt(v?.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Department Spend ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Department Fulfillment Spend</h3>
        </div>
        {deptMap?.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Department', 'Total Spend']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deptMap?.map(d => (
                  <tr key={d?.name} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 px-4 text-xs font-medium">{d?.name}</td>
                    <td className="py-2.5 px-4 text-xs font-semibold text-emerald-700">{fmt(d?.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Top Items by Cost ────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Top Items by Fulfillment Cost</h3>
        </div>
        {topItems?.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">No data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Item Name', 'SKU', 'Department', 'Vendor', 'Qty Supplied', 'Total Cost']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topItems?.map((item, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 px-3 text-xs font-medium max-w-[180px] truncate">{dash(item?.item_name)}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{dash(item?.sku)}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{dash(item?.department)}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{dash(item?.vendor)}</td>
                    <td className="py-2.5 px-3 text-xs">{fmtNum(item?.qty)}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-emerald-700">{fmt(item?.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Endo File Detail ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Endo File Detail (EdgeEndo)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Endodontic file supplies delivered — broken down by SKU where available</p>
        </div>
        {endoRows?.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">No endo file rows found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['SKU', 'Item / File Description', 'Office', 'Qty Supplied', 'Unit Cost', 'Total Cost']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {endoRows?.map(r => (
                  <tr key={r?.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono">{dash(r?.sku)}</td>
                    <td className="py-2.5 px-3 text-xs font-medium max-w-[200px] truncate">{dash(r?.item_name)}</td>
                    <td className="py-2.5 px-3 text-xs">{r?.office_id?.split(' ')?.pop() || '—'}</td>
                    <td className="py-2.5 px-3 text-xs">{fmtNum(r?.qty_supplied)}</td>
                    <td className="py-2.5 px-3 text-xs">{r?.unit_cost != null ? fmt(r?.unit_cost) : '—'}</td>
                    <td className="py-2.5 px-3 text-xs font-semibold text-emerald-700">{fmt(r?.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Rows Missing Cost ────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Rows Missing Cost</h3>
          {missingCostRows?.length > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
              {missingCostRows?.length}
            </span>
          )}
        </div>
        <div className="px-5 py-2 bg-orange-50 border-b border-orange-100">
          <p className="text-xs text-orange-700">
            These rows are excluded from all spend totals. Manual review may be required to assign cost.
          </p>
        </div>
        {missingCostRows?.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-sm text-muted-foreground">
            <Icon name="CheckCircle" size={14} className="mr-1.5 text-emerald-500" />No rows missing cost
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Item', 'Office', 'Vendor', 'Date Supplied', 'Notes / Manual Review']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {missingCostRows?.map(r => (
                  <tr key={r?.id} className="border-b border-border/50 bg-orange-50/40 hover:bg-orange-50">
                    <td className="py-2.5 px-3 text-xs font-medium max-w-[160px] truncate">{dash(r?.item_name)}</td>
                    <td className="py-2.5 px-3 text-xs">{r?.office_id?.split(' ')?.pop() || '—'}</td>
                    <td className="py-2.5 px-3 text-xs">{r?.supply_vendors?.name || '—'}</td>
                    <td className="py-2.5 px-3 text-xs whitespace-nowrap">{dash(r?.date_supplied)}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {r?.tracking_notes || <span className="italic text-orange-600">Manual review needed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FulfillmentSpendTab;
