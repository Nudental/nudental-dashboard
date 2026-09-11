/**
 * DentrixReconciliationTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Financial Analytics subtab: Dentrix Reconciliation
 * Row-level reconciliation of Nu Dashboard vs eAssist benchmark workbook.
 * Super Admin only.
 */

import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchBenchmarkReconciliation, safeNum } from '../../../services/dentrixNormalizedService';

const fmtFull = (v) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(safeNum(v));
};

const fmtDelta = (v) => {
  if (v === null || v === undefined) return '—';
  const n = safeNum(v);
  const cls = Math.abs(n) <= 1 ? 'text-emerald-600' : n > 0 ? 'text-amber-600' : 'text-red-600';
  return <span className={`font-mono text-xs ${cls}`}>{n >= 0 ? '+' : ''}{fmtFull(n)}</span>;
};

const BENCHMARK_METRICS = ['daily_production', 'net_daily_production', 'daily_total_coll', 'monthly_production', 'net_monthly_production', 'total_monthly_coll'];

export const getBenchmarkDelta = (benchmark, dashboard) => {
  const numeric = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
  if (!numeric(benchmark) || !numeric(dashboard)) return null;
  return Number((Number(benchmark) - Number(dashboard)).toFixed(2));
};

export const getBenchmarkStatus = (row) => {
  const deltas = BENCHMARK_METRICS.map(metric => getBenchmarkDelta(row?.[metric], row?.[`dashboard_${metric}`]));
  if (deltas.some(delta => delta !== null && Math.abs(delta) > 1)) return 'mismatch';
  if (deltas.some(delta => delta === null)) return 'pending';
  return 'ok';
};

const ReconciliationBadge = ({ status }) => {
  if (status === 'pending') return <span className="text-muted-foreground text-xs">Pending</span>;
  return status === 'mismatch'
    ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700"><Icon name="XCircle" size={10} /> MISMATCH</span>
    : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700"><Icon name="CheckCircle2" size={10} /> OK</span>;
};

const OFFICES = ['All', 'Barnegat', 'Brick', 'Eatontown', 'Staten Island'];

const DentrixReconciliationTab = ({ isSuperAdmin = false }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [officeFilter, setOfficeFilter] = useState('All');
  const [showMismatchOnly, setShowMismatchOnly] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchBenchmarkReconciliation({
          officeCanonical: officeFilter !== 'All' ? officeFilter : null,
        });
        setRows(data);
      } catch (err) {
        setError(err?.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [officeFilter]);

  const filtered = useMemo(() => {
    if (!showMismatchOnly) return rows;
    return rows?.filter(r => getBenchmarkStatus(r) === 'mismatch');
  }, [rows, showMismatchOnly]);

  const summary = useMemo(() => {
    const total = rows?.length;
    const mismatches = rows?.filter(r => getBenchmarkStatus(r) === 'mismatch')?.length;
    const reconciled = rows?.filter(r => r?.reconciled_at)?.length;
    return { total, mismatches, reconciled, pending: total - reconciled };
  }, [rows]);

  if (!isSuperAdmin) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <Icon name="Lock" size={24} className="text-amber-500 mx-auto mb-2" />
        <p className="text-sm font-medium text-amber-800">Super Admin access required</p>
        <p className="text-xs text-amber-600 mt-1">This reconciliation panel is only available to super administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Icon name="FlaskConical" size={16} className="text-amber-500" />
            eAssist Benchmark Reconciliation
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Row-level comparison of Nu Dashboard vs eAssist Daily Reports 2026 workbook.
            Offices covered: Barnegat, Brick, Eatontown (Feb–Apr 2026).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={officeFilter}
            onChange={e => setOfficeFilter(e?.target?.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showMismatchOnly}
              onChange={e => setShowMismatchOnly(e?.target?.checked)}
              className="rounded"
            />
            Mismatches only
          </label>
        </div>
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Rows', value: summary?.total, icon: 'Database', bg: 'bg-blue-50', text: 'text-blue-700' },
          { label: 'Mismatches', value: summary?.mismatches, icon: 'AlertTriangle', bg: 'bg-red-50', text: 'text-red-700' },
          { label: 'Reconciled', value: summary?.reconciled, icon: 'CheckCircle2', bg: 'bg-emerald-50', text: 'text-emerald-700' },
          { label: 'Pending', value: summary?.pending, icon: 'Clock', bg: 'bg-amber-50', text: 'text-amber-700' },
        ]?.map(c => (
          <div key={c?.label} className={`${c?.bg} border border-border rounded-xl p-3 flex items-center gap-3`}>
            <Icon name={c?.icon} size={16} className={c?.text} />
            <div>
              <p className="text-xs text-muted-foreground">{c?.label}</p>
              <p className={`text-xl font-bold ${c?.text}`}>{c?.value}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Anchor rows notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
        <Icon name="Info" size={12} className="inline mr-1.5" />
        <strong>Anchor rows loaded:</strong> 2026-04-22 Barnegat, Brick, Eatontown + 2026-04-21 Brick.
        Full workbook import can be done via the Admin Import tool. Dashboard values will populate once Dentrix sync runs for matching dates.
      </div>
      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3]?.map(i => (
            <div key={i} className="bg-card border border-border rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <Icon name="AlertTriangle" size={14} className="inline mr-2" />
          {error}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          <Icon name="Database" size={24} className="mx-auto mb-2 opacity-40" />
          No benchmark rows found. Import the eAssist workbook to populate this table.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs min-w-[1200px]">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Date</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Office</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Benchmark Daily Prod</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Dashboard Daily Prod</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Δ Daily Prod</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Benchmark Net MTD</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Dashboard Net MTD</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Δ Net MTD</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Benchmark Total Coll</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Dashboard Total Coll</th>
                <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">Δ Total Coll</th>
                <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered?.map(row => {
                const status = getBenchmarkStatus(row);
                return (
                  <tr
                    key={row?.id}
                    className={`hover:bg-muted/40 transition-colors ${status === 'mismatch' ? 'bg-red-50/30' : ''}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{row?.report_date}</td>
                    <td className="px-3 py-2.5 text-foreground">{row?.office_canonical}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtFull(row?.daily_production)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtFull(row?.dashboard_daily_production)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtDelta(getBenchmarkDelta(row?.daily_production, row?.dashboard_daily_production))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtFull(row?.net_monthly_production)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtFull(row?.dashboard_net_monthly_production)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtDelta(getBenchmarkDelta(row?.net_monthly_production, row?.dashboard_net_monthly_production))}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtFull(row?.total_monthly_coll)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtFull(row?.dashboard_total_monthly_coll)}</td>
                    <td className="px-3 py-2.5 text-right">{fmtDelta(getBenchmarkDelta(row?.total_monthly_coll, row?.dashboard_total_monthly_coll))}</td>
                    <td className="px-3 py-2.5 text-center">
                      <ReconciliationBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Tolerance: ±$1.00. Rows with no dashboard value show benchmark only (sync pending).
        Source: eAssist Daily Reports 2026 workbook.
      </p>
    </div>
  );
};

export default DentrixReconciliationTab;
