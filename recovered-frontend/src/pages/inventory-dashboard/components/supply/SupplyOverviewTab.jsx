import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Icon from '../../../../components/AppIcon';
import { supabase } from '../../../../lib/supabase';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const fmt$ = (v) =>
  v == null ? '—' : `$${Number(v)?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (raw) => {
  if (!raw) return '—';
  // Detect obviously wrong future years (> current year + 1)
  const d = new Date(raw);
  if (isNaN(d?.getTime())) return '—';
  const year = d?.getFullYear();
  const currentYear = new Date()?.getFullYear();
  if (year > currentYear + 1) {
    // Return the raw string with a warning flag so the UI can surface it
    return { display: raw, warning: true };
  }
  return d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const shortOffice = (name) => {
  if (!name) return '—';
  const parts = String(name)?.split(' ');
  return parts?.[parts?.length - 1];
};

/**
 * Build ISO date strings for the first and last day of a YYYY-MM month string.
 * Uses local-time Date constructor to avoid UTC midnight shift that causes
 * new Date("2026-01-01") to resolve as Dec 31 2025 in US Eastern time,
 * making monthEnd calculate as "2025-12-31" instead of "2026-01-31".
 */
const getMonthBounds = (yyyyMM) => {
  if (!yyyyMM || !/^\d{4}-\d{2}$/?.test(yyyyMM)) {
    // Fallback: current month
    const now = new Date();
    const y = now?.getFullYear();
    const m = now?.getMonth(); // 0-indexed
    const lastDay = new Date(y, m + 1, 0)?.getDate();
    const mm = String(m + 1)?.padStart(2, '0');
    return {
      monthStart: `${y}-${mm}-01`,
      monthEnd: `${y}-${mm}-${String(lastDay)?.padStart(2, '0')}`,
    };
  }
  const [yearStr, monthStr] = yyyyMM?.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed
  // Last day: day 0 of next month = last day of this month
  const lastDay = new Date(year, month, 0)?.getDate();
  const mm = String(month)?.padStart(2, '0');
  return {
    monthStart: `${year}-${mm}-01`,
    monthEnd: `${year}-${mm}-${String(lastDay)?.padStart(2, '0')}`,
  };
};

/* ─── StatCard ────────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, sub, icon, color, badge = null, warn = false }) => (
  <div className={`bg-card border rounded-2xl p-5 flex items-start gap-4 ${warn ? 'border-amber-300' : 'border-border'}`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon name={icon} size={18} className="text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xl font-bold text-foreground">{value ?? '—'}</span>
        {badge && (
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full animate-pulse">
            {badge}
          </span>
        )}
        {warn && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
            REVIEW
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </div>
);

/* ─── status badge helper ─────────────────────────────────────────────────── */
const statusBadge = (status) => {
  const map = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-700',
    under_review: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    partially_fulfilled: 'bg-orange-100 text-orange-700',
    fulfilled: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return map?.[status] || 'bg-gray-100 text-gray-700';
};

/* ─── OFFICES ─────────────────────────────────────────────────────────────── */
const OFFICES = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

/* ═══════════════════════════════════════════════════════════════════════════ */
const SupplyOverviewTab = ({ officeFilter, monthFilter }) => {
  /* ── state ── */
  const [kpi, setKpi] = useState(null);
  const [spendByOffice, setSpendByOffice] = useState([]);
  const [recentlySupplied, setRecentlySupplied] = useState([]);
  const [dateWarning, setDateWarning] = useState(false);
  const [urgentRequests, setUrgentRequests] = useState([]);
  const [monthlyStatus, setMonthlyStatus] = useState([]);
  const [requestsByOffice, setRequestsByOffice] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── derived month bounds ── */
  // Use the safe local-time getMonthBounds() to avoid UTC timezone shift.
  // monthFilter is "YYYY-MM" from the <input type="month"> in MonthlySupplyModule.
  const currentMonth = monthFilter || new Date()?.toISOString()?.slice(0, 7);
  const { monthStart, monthEnd } = getMonthBounds(currentMonth);
  const officeId = officeFilter !== 'All Offices' ? officeFilter : null;

  /* ── load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      /* 1 ── Pending Clinical Requests (Back Staff submitted/under_review) */
      let pendingQ = supabase?.from('supply_request_batches')?.select('*', { count: 'exact', head: true })?.eq('department_category', 'Back Staff')?.in('batch_status', ['submitted', 'under_review']);
      if (officeId) pendingQ = pendingQ?.eq('office_id', officeId);
      if (monthFilter) pendingQ = pendingQ?.eq('request_month', `${currentMonth}-01`);

      /* 2 ── Open Urgent Requests (Clinical Supply only — not Front Desk) */
      let urgentOpenQ = supabase?.from('urgent_supply_requests')?.select('*', { count: 'exact', head: true })?.not('urgent_status', 'in', '("fulfilled","closed","rejected","cancelled")');
      if (officeId) urgentOpenQ = urgentOpenQ?.eq('office_id', officeId);

      /* 3 ── Fulfilled This Month (supply_fulfillment_logs rows) */
      let fulfilledQ = supabase?.from('supply_fulfillment_logs')?.select('*', { count: 'exact', head: true })?.gte('date_supplied', monthStart)?.lte('date_supplied', monthEnd);
      if (officeId) fulfilledQ = fulfilledQ?.eq('office_id', officeId);

      /* 4 ── Supply Fulfillment Spend This Month (sum total_cost) */
      let spendQ = supabase?.from('supply_fulfillment_logs')?.select('total_cost')?.not('total_cost', 'is', null)?.gte('date_supplied', monthStart)?.lte('date_supplied', monthEnd);
      if (officeId) spendQ = spendQ?.eq('office_id', officeId);

      /* 5 ── Rows Missing Cost this month */
      let missingQ = supabase?.from('supply_fulfillment_logs')?.select('*', { count: 'exact', head: true })?.is('total_cost', null)?.gte('date_supplied', monthStart)?.lte('date_supplied', monthEnd);
      if (officeId) missingQ = missingQ?.eq('office_id', officeId);

      /* 6 ── Estimated / Pro-Rated rows (tracking_notes keywords) */
      let estimatedQ = supabase?.from('supply_fulfillment_logs')?.select('id, total_cost, tracking_notes')?.not('tracking_notes', 'is', null)?.gte('date_supplied', monthStart)?.lte('date_supplied', monthEnd);
      if (officeId) estimatedQ = estimatedQ?.eq('office_id', officeId);

      /* 7 ── Fulfillment Spend by Office (selected month) */
      let spendByOfficeQ = supabase?.from('supply_fulfillment_logs')?.select('office_id, total_cost')?.not('total_cost', 'is', null)?.gte('date_supplied', monthStart)?.lte('date_supplied', monthEnd);
      // Note: intentionally NOT filtering by officeId here so the chart always shows all offices
      // when "All Offices" is selected; when a specific office is selected, filter applies.
      if (officeId) spendByOfficeQ = spendByOfficeQ?.eq('office_id', officeId);

      /* 8 ── Recent Supplies Delivered — MUST respect selected month and office filter */
      let recentQ = supabase?.from('supply_fulfillment_logs')?.select(`
          id, item_name, office_id, date_supplied, qty_supplied,
          total_cost, tracking_notes,
          supply_vendors(name)
        `)
        ?.gte('date_supplied', monthStart)
        ?.lte('date_supplied', monthEnd)
        ?.order('date_supplied', { ascending: false })
        ?.limit(15);
      if (officeId) recentQ = recentQ?.eq('office_id', officeId);

      /* 9 ── Unresolved Urgent Requests (full rows) */
      let urgentRowsQ = supabase?.from('urgent_supply_requests')?.select('id, custom_item_name, office_id, priority, urgent_status, created_at')?.not('urgent_status', 'in', '("fulfilled","closed","rejected","cancelled")')?.order('created_at', { ascending: false })?.limit(20);
      if (officeId) urgentRowsQ = urgentRowsQ?.eq('office_id', officeId);

      /* 10 ── Monthly Request Status by Office (Back Staff only) */
      let batchesQ = supabase?.from('supply_request_batches')?.select('office_id, batch_status')?.eq('department_category', 'Back Staff');
      if (officeId) batchesQ = batchesQ?.eq('office_id', officeId);
      if (monthFilter) batchesQ = batchesQ?.eq('request_month', `${currentMonth}-01`);

      /* 11 ── Requests by Office (Back Staff only) */
      let reqByOfficeQ = supabase?.from('supply_request_batches')?.select('office_id, batch_status')?.eq('department_category', 'Back Staff');
      if (officeId) reqByOfficeQ = reqByOfficeQ?.eq('office_id', officeId);
      if (monthFilter) reqByOfficeQ = reqByOfficeQ?.eq('request_month', `${currentMonth}-01`);

      /* ── fire all in parallel ── */
      const [
        pendingRes, urgentOpenRes, fulfilledRes, spendRes, missingRes,
        estimatedRes, spendByOfficeRes, recentRes, urgentRowsRes,
        batchesRes, reqByOfficeRes,
      ] = await Promise.all([
        pendingQ, urgentOpenQ, fulfilledQ, spendQ, missingQ,
        estimatedQ, spendByOfficeQ, recentQ, urgentRowsQ,
        batchesQ, reqByOfficeQ,
      ]);

      /* ── KPI: spend sum ── */
      const spendTotal = (spendRes?.data || [])?.reduce((s, r) => s + Number(r?.total_cost || 0), 0);

      /* ── KPI: estimated/pro-rated ── */
      const ESTIMATED_KEYWORDS = ['crest', 'oral-b', 'pro-rated', 'prorated', 'estimated', 'bundle', 'prorate'];
      const estimatedRows = (estimatedRes?.data || [])?.filter(r =>
        ESTIMATED_KEYWORDS?.some(kw => (r?.tracking_notes || '')?.toLowerCase()?.includes(kw))
      );
      const estimatedSpend = estimatedRows?.reduce((s, r) => s + Number(r?.total_cost || 0), 0);

      setKpi({
        pendingClinical: pendingRes?.count ?? 0,
        openUrgent: urgentOpenRes?.count ?? 0,
        fulfilledThisMonth: fulfilledRes?.count ?? 0,
        spendThisMonth: spendTotal,
        missingCost: missingRes?.count ?? 0,
        estimatedCount: estimatedRows?.length,
        estimatedSpend,
      });

      /* ── Spend by Office chart ── */
      const officeSpendMap = {};
      (spendByOfficeRes?.data || [])?.forEach(r => {
        const key = r?.office_id || 'Unknown';
        officeSpendMap[key] = (officeSpendMap?.[key] || 0) + Number(r?.total_cost || 0);
      });
      setSpendByOffice(
        Object.entries(officeSpendMap)?.map(([office, spend]) => ({
          office: shortOffice(office),
          fullOffice: office,
          spend: Math.round(spend * 100) / 100,
        }))?.sort((a, b) => b?.spend - a?.spend)
      );

      /* ── Recently Supplied ── */
      let hasDateWarning = false;
      const recentRows = (recentRes?.data || [])?.map(r => {
        const dateResult = fmtDate(r?.date_supplied);
        let displayDate, warnDate;
        if (typeof dateResult === 'object' && dateResult?.warning) {
          displayDate = dateResult?.display;
          warnDate = true;
          hasDateWarning = true;
        } else {
          displayDate = dateResult;
          warnDate = false;
        }
        return {
          ...r,
          displayDate,
          warnDate,
          vendorName: r?.supply_vendors?.name || '—',
        };
      });
      setRecentlySupplied(recentRows);
      setDateWarning(hasDateWarning);

      /* ── Urgent Requests ── */
      setUrgentRequests(urgentRowsRes?.data || []);

      /* ── Monthly Status by Office ── */
      const officeStatus = {};
      OFFICES?.forEach(o => {
        officeStatus[o] = { office: o, draft: 0, submitted: 0, under_review: 0, approved: 0, fulfilled: 0, rejected: 0 };
      });
      (batchesRes?.data || [])?.forEach(b => {
        const key = b?.office_id;
        if (!officeStatus?.[key]) {
          officeStatus[key] = { office: key, draft: 0, submitted: 0, under_review: 0, approved: 0, fulfilled: 0, rejected: 0 };
        }
        const s = b?.batch_status;
        if (officeStatus?.[key]?.[s] !== undefined) officeStatus[key][s]++;
      });
      setMonthlyStatus(Object.values(officeStatus));

      /* ── Requests by Office chart ── */
      const reqMap = {};
      (reqByOfficeRes?.data || [])?.forEach(r => {
        const key = r?.office_id || 'Unknown';
        if (!reqMap?.[key]) reqMap[key] = { office: shortOffice(key), pending: 0, fulfilled: 0 };
        if (['submitted', 'under_review', 'approved']?.includes(r?.batch_status)) reqMap[key].pending++;
        if (r?.batch_status === 'fulfilled') reqMap[key].fulfilled++;
      });
      setRequestsByOffice(Object.values(reqMap));

    } catch (e) {
      console.error('[SupplyOverviewTab] load error:', e);
    } finally {
      setLoading(false);
    }
  }, [officeFilter, monthFilter, officeId, currentMonth, monthStart, monthEnd]);

  useEffect(() => { load(); }, [load]);

  /* ── loading ── */
  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  /* ── render ── */
  return (
    <div className="space-y-6">
      {/* ── Scope / Disclaimer Banner ── */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
        <Icon name="Info" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <span className="font-semibold">Clinical Supply Overview</span> shows Back Staff / Clinical requests,
          urgent requests, supplies delivered, and supply fulfillment spend.
          It is <span className="font-semibold">not</span> actual clinical consumption and
          <span className="font-semibold"> not</span> Finance P&amp;L.
        </p>
      </div>
      {/* ── Date Warning Banner ── */}
      {dateWarning && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-2xl">
          <Icon name="AlertTriangle" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Date Issue Detected:</span> One or more recently supplied items
            show a future date (possible year &gt; {new Date()?.getFullYear() + 1}). This may indicate a
            date parsing issue in the imported data. The raw date value is shown — please verify the
            source record in the Fulfillment Log.
          </p>
        </div>
      )}
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Pending Clinical Requests"
          value={kpi?.pendingClinical ?? '—'}
          sub="Back Staff submitted/under review"
          icon="ClipboardList"
          color="bg-blue-500"
          badge={kpi?.pendingClinical > 0 ? 'PENDING' : null}
        />
        <StatCard
          label="Open Urgent Requests"
          value={kpi?.openUrgent ?? '—'}
          sub="Clinical Supply only"
          icon="AlertTriangle"
          color="bg-red-500"
          badge={kpi?.openUrgent > 0 ? 'OPEN' : null}
        />
        <StatCard
          label="Supplies Delivered"
          value={kpi?.fulfilledThisMonth ?? '—'}
          sub="Fulfillment rows this month"
          icon="CheckCircle"
          color="bg-emerald-500"
        />
        <StatCard
          label="Supply Fulfillment Spend"
          value={fmt$(kpi?.spendThisMonth)}
          sub="From supply_fulfillment_logs"
          icon="DollarSign"
          color="bg-indigo-500"
        />
        <StatCard
          label="Rows Missing Cost"
          value={kpi?.missingCost ?? '—'}
          sub="total_cost is null this month"
          icon="AlertCircle"
          color="bg-orange-500"
          warn={kpi?.missingCost > 0}
        />
        <StatCard
          label="Estimated / Pro-Rated"
          value={kpi?.estimatedCount ?? '—'}
          sub={kpi?.estimatedSpend > 0 ? `≈ ${fmt$(kpi?.estimatedSpend)}` : 'Crest+Oral-B bundle rows'}
          icon="Tag"
          color="bg-yellow-500"
        />
      </div>
      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Clinical Supply Requests by Office */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Clinical Supply Requests by Office</h3>
          <p className="text-xs text-muted-foreground mb-4">Back Staff / Clinical only — no Front Desk batches</p>
          {requestsByOffice?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={requestsByOffice} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="office" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip formatter={(v, n) => [v, n === 'pending' ? 'Pending' : 'Fulfilled']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pending" fill="#f59e0b" name="Pending" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fulfilled" fill="#10b981" name="Fulfilled" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No request data for selected period</div>
          )}
        </div>

        {/* Supply Fulfillment Spend by Office */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Supply Fulfillment Spend by Office</h3>
          <p className="text-xs text-muted-foreground mb-4">From supply_fulfillment_logs.total_cost — not Finance P&amp;L</p>
          {spendByOffice?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={spendByOffice} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="office" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000)?.toFixed(1)}k`} />
                <RechartsTooltip formatter={(v) => [fmt$(v), 'Fulfillment Spend']} />
                <Bar dataKey="spend" fill="#6366f1" name="Fulfillment Spend" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No fulfillment spend data for selected period</div>
          )}
        </div>
      </div>
      {/* ── Tables Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Unresolved Urgent Requests — Clinical Supply only */}
        <div className="bg-card border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="AlertTriangle" size={16} className="text-red-600" />
            <h3 className="text-sm font-semibold text-foreground">Unresolved Urgent Requests</h3>
            <span className="text-xs text-muted-foreground">(Clinical Supply only)</span>
            {urgentRequests?.length > 0 && (
              <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full animate-pulse">
                {urgentRequests?.length}
              </span>
            )}
          </div>
          {urgentRequests?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No unresolved urgent requests</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {urgentRequests?.map(r => (
                <div key={r?.id} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r?.custom_item_name || 'Item'}</p>
                    <p className="text-xs text-muted-foreground">{shortOffice(r?.office_id)} · {r?.priority?.toUpperCase() || '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${statusBadge(r?.urgent_status)}`}>
                    {r?.urgent_status || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Supplies Delivered */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="Truck" size={16} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-foreground">Recent Supplies Delivered</h3>
            {dateWarning && (
              <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                DATE ISSUE
              </span>
            )}
          </div>
          {recentlySupplied?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No supplies delivered yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Item</th>
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Office</th>
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Date</th>
                    <th className="text-center py-1.5 px-2 text-muted-foreground font-semibold">Qty</th>
                    <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Vendor</th>
                    <th className="text-right py-1.5 px-2 text-muted-foreground font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlySupplied?.map(r => (
                    <tr key={r?.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="py-1.5 px-2 font-medium text-foreground max-w-[120px] truncate">{r?.item_name || '—'}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{shortOffice(r?.office_id)}</td>
                      <td className={`py-1.5 px-2 ${r?.warnDate ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}`}>
                        {r?.warnDate ? `⚠ ${r?.displayDate}` : r?.displayDate}
                      </td>
                      <td className="py-1.5 px-2 text-center text-emerald-600 font-semibold">+{r?.qty_supplied ?? '—'}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{r?.vendorName}</td>
                      <td className="py-1.5 px-2 text-right font-semibold text-foreground">{fmt$(r?.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* ── Monthly Request Status by Office ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="BarChart2" size={16} className="text-indigo-600" />
          <h3 className="text-sm font-semibold text-foreground">Monthly Request Status by Office</h3>
          <span className="text-xs text-muted-foreground">(Back Staff / Clinical only)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Office</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Draft</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Submitted</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Under Review</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Approved</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Fulfilled</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {monthlyStatus?.map(row => (
                <tr key={row?.office} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2.5 px-3 font-medium text-foreground">{shortOffice(row?.office)}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge('draft')}`}>{row?.draft || 0}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge('submitted')}`}>{row?.submitted || 0}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge('under_review')}`}>{row?.under_review || 0}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge('approved')}`}>{row?.approved || 0}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge('fulfilled')}`}>{row?.fulfilled || 0}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge('rejected')}`}>{row?.rejected || 0}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupplyOverviewTab;
