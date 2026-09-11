import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../../components/AppIcon';
import { fetchGustoExpenseReconciliation, fetchUnresolvedOfficeWarnings, syncGustoExpenseFacts } from '../../../../services/expenseService';


const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })?.format(v || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * GustoExpenseReconciliation
 * Admin-visible panel that validates Gusto expense facts match source payroll data.
 * Shows warnings for mismatches and unresolved office mappings.
 * Accessible from the Gusto Payroll tab (Import History or Overview).
 */
const GustoExpenseReconciliation = ({ className = '' }) => {
  const now = new Date();
  const [startDate, setStartDate] = useState(`${now?.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(now?.toISOString()?.slice(0, 10));
  const [result, setResult] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const runReconciliation = useCallback(async () => {
    setLoading(true);
    try {
      const [reconcileData, warningRows] = await Promise.allSettled([
        fetchGustoExpenseReconciliation({ startDate, endDate }),
        fetchUnresolvedOfficeWarnings(),
      ]);
      if (reconcileData?.status === 'fulfilled') setResult(reconcileData?.value);
      if (warningRows?.status === 'fulfilled') setWarnings(warningRows?.value || []);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    runReconciliation();
  }, [runReconciliation]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncGustoExpenseFacts();
      setSyncResult(res);
      await runReconciliation();
    } finally {
      setSyncing(false);
    }
  };

  const isReconciled = result?.is_reconciled;
  const reconcileWarnings = result?.warnings || [];

  return (
    <div className={`bg-card border border-border rounded-xl ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-smooth rounded-xl"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            loading ? 'bg-muted' :
            isReconciled === false ? 'bg-red-50' :
            isReconciled === true ? 'bg-emerald-50' : 'bg-muted'
          }`}>
            <Icon
              name={loading ? 'Loader2' : isReconciled === false ? 'AlertTriangle' : isReconciled === true ? 'CheckCircle' : 'BarChart2'}
              size={16}
              className={`${loading ? 'animate-spin text-muted-foreground' : isReconciled === false ? 'text-red-500' : isReconciled === true ? 'text-emerald-500' : 'text-muted-foreground'}`}
            />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Gusto Expense Reconciliation</p>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Checking…' :
               isReconciled === true ? 'All totals reconciled ✓' :
               isReconciled === false ? `${reconcileWarnings?.length} mismatch${reconcileWarnings?.length !== 1 ? 'es' : ''} detected` :
               'Validate payroll vs expense totals'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {warnings?.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {warnings?.length} unresolved office{warnings?.length !== 1 ? 's' : ''}
            </span>
          )}
          <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground" />
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t border-border">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mt-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-medium">From</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e?.target?.value)}
                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-medium">To</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e?.target?.value)}
                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={runReconciliation}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 rounded-lg transition-smooth disabled:opacity-50"
            >
              <Icon name="RefreshCw" size={12} className={loading ? 'animate-spin' : ''} />
              Run Check
            </button>
            {/* V329 SAFETY GATE — Gusto expense re-sync disabled during payroll source verification */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <Icon name="AlertTriangle" size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
                  Gusto expense re-sync writes to gusto_expense_facts and is disabled during payroll source verification.
                </p>
              </div>
              <button
                disabled
                title="Gusto expense re-sync is disabled during payroll source verification"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed opacity-60"
              >
                <Icon name="RefreshCw" size={12} />
                Re-sync Gusto Expenses (Disabled)
              </button>
            </div>
          </div>

          {/* Sync result */}
          {syncResult && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg mb-4">
              <Icon name="CheckCircle" size={14} className="text-emerald-600 flex-shrink-0" />
              <p className="text-xs text-emerald-700">
                Sync complete — {syncResult?.inserted} rows processed
                {syncResult?.errors?.length > 0 && `, ${syncResult?.errors?.length} errors`}
              </p>
            </div>
          )}

          {/* Reconciliation results */}
          {result && !loading && (
            <div className="space-y-3">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Payroll Source (Gusto Runs)', value: result?.payroll_source_total, color: 'text-foreground' },
                  { label: 'Payroll in Expense Layer', value: result?.payroll_expense_total, color: 'text-foreground' },
                  { label: 'Payroll Variance', value: Math.abs(result?.payroll_source_total - result?.payroll_expense_total), color: Math.abs(result?.payroll_source_total - result?.payroll_expense_total) > 0.01 ? 'text-red-600' : 'text-emerald-600' },
                  { label: 'Contractors Source', value: result?.contractor_source_total, color: 'text-foreground' },
                  { label: 'Contractors in Expense Layer', value: result?.contractor_expense_total, color: 'text-foreground' },
                  { label: 'Contractors Variance', value: Math.abs(result?.contractor_source_total - result?.contractor_expense_total), color: Math.abs(result?.contractor_source_total - result?.contractor_expense_total) > 0.01 ? 'text-red-600' : 'text-emerald-600' },
                ]?.map(card => (
                  <div key={card?.label} className="bg-muted/30 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground mb-1 leading-tight">{card?.label}</p>
                    <p className={`text-sm font-bold ${card?.color}`}>{fmt(card?.value)}</p>
                  </div>
                ))}
              </div>

              {/* Mismatch warnings */}
              {reconcileWarnings?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Mismatches Detected</p>
                  {reconcileWarnings?.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <Icon name="AlertTriangle" size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-red-700">{w?.category}</p>
                        <p className="text-xs text-red-600 mt-0.5">{w?.message}</p>
                        <p className="text-xs text-red-500 mt-0.5">
                          Source: {fmt(w?.source_total)} · Expense Layer: {fmt(w?.expense_total)} · Variance: {fmt(w?.variance)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All clear */}
              {reconcileWarnings?.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <Icon name="CheckCircle" size={14} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium">
                    All Gusto expense totals reconcile with source payroll data for this period.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Unresolved office warnings */}
          {warnings?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
                Unresolved Office Mappings ({warnings?.length})
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-muted-foreground font-medium">Category</th>
                      <th className="text-right py-2 px-2 text-muted-foreground font-medium">Amount</th>
                      <th className="text-left py-2 px-2 text-muted-foreground font-medium">Date</th>
                      <th className="text-left py-2 px-2 text-muted-foreground font-medium">Employee</th>
                      <th className="text-left py-2 px-2 text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warnings?.slice(0, 20)?.map(w => (
                      <tr key={w?.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-2 text-foreground font-medium">{w?.expense_category}</td>
                        <td className="py-2 px-2 text-right text-foreground">{fmt(w?.expense_amount)}</td>
                        <td className="py-2 px-2 text-muted-foreground">{fmtDate(w?.expense_date)}</td>
                        <td className="py-2 px-2 text-muted-foreground">{w?.gusto_employee_name || '—'}</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                            {w?.office_mapping_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {warnings?.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Showing 20 of {warnings?.length} unresolved records
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GustoExpenseReconciliation;
