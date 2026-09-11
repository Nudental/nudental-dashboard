import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayrollSyncDashboard() {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Page-level guard: require finance.payroll_sync.view or super_admin
  if (!permLoading && userProfile && !isSuperAdmin && !hasPermission('finance.payroll_sync.view')) {
    return <AccessDenied message="Payroll Sync Dashboard is restricted. Contact your administrator to request access." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="RefreshCw" className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Payroll Sync Dashboard</h1>
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-semibold">Super Admin</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Payroll sync status for Dentrix, Gusto, and MEA payroll sources
            </p>
          </div>

          {/* Sync All — disabled until live source is connected */}
          <button
            disabled
            title="Disabled until live source is connected"
            className="flex items-center gap-2 px-4 py-2.5 bg-muted text-muted-foreground rounded-xl text-sm font-semibold cursor-not-allowed opacity-60 self-start sm:self-auto"
          >
            <Icon name="Zap" className="w-4 h-4" />
            Sync All Sources
          </button>
        </div>

        {/* ── Not-Connected Banner ── */}
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="AlertTriangle" className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                Payroll Sync is not yet connected to a live source
              </h2>
              <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                No real provider conflicts are currently displayed. All data on this page is empty until a live integration is wired.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed border-t border-amber-200 dark:border-amber-700 pt-2 mt-2">
                This page will be wired later to Dentrix, Gusto, and provider mapping data. Until then, no provider sync conflicts should be treated as real.
              </p>
            </div>
          </div>
        </div>

        {/* ── Summary KPI Strip — all zeroed, clearly labeled ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Conflicts', value: '—', icon: 'AlertTriangle', color: 'text-muted-foreground' },
            { label: 'Critical', value: '—', icon: 'AlertOctagon', color: 'text-muted-foreground' },
            { label: 'High Priority', value: '—', icon: 'AlertCircle', color: 'text-muted-foreground' },
            { label: 'Sources Active', value: '—', icon: 'CheckCircle2', color: 'text-muted-foreground' },
          ]?.map(kpi => (
            <div key={kpi?.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 opacity-60">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Icon name={kpi?.icon} className={`w-4 h-4 ${kpi?.color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold ${kpi?.color}`}>{kpi?.value}</p>
                <p className="text-xs text-muted-foreground">{kpi?.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Source Cards — no fake metrics ── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Icon name="Database" className="w-4 h-4 text-muted-foreground" />
            Payroll Sources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'dentrix', name: 'Dentrix Ascend', icon: 'Stethoscope', description: 'Provider production & collections payroll data' },
              { id: 'gusto',   name: 'Gusto Payroll',  icon: 'Banknote',    description: 'Employee payroll runs, benefits & contractor payments' },
              { id: 'mea',     name: 'Manual MEA Payroll', icon: 'FilePen', description: 'Manually entered MEA payroll adjustments & overrides' },
            ]?.map(src => (
              <div key={src?.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 opacity-70">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon name={src?.icon} className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground leading-tight">{src?.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{src?.description}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-slate-400" />
                    Not Connected
                  </span>
                </div>

                <div className="bg-muted/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground italic">No live data — source not yet wired</p>
                </div>

                {/* Sync Now — disabled */}
                <button
                  disabled
                  title="Disabled until live source is connected"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                >
                  <Icon name="RefreshCw" className="w-4 h-4" />
                  Sync Now — disabled until live source is connected
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Conflict Resolution Queue ── */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="ListChecks" className="w-4 h-4 text-muted-foreground" />
                Conflict Resolution Queue
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">No real provider conflicts are available until a live source is connected</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Source filter — disabled */}
              <select
                disabled
                title="Disabled until live source is connected"
                className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs text-muted-foreground cursor-not-allowed opacity-60"
              >
                <option>All Sources — disabled</option>
              </select>

              {/* Severity filter — disabled */}
              <select
                disabled
                title="Disabled until live source is connected"
                className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs text-muted-foreground cursor-not-allowed opacity-60"
              >
                <option>All Severities — disabled</option>
              </select>

              {/* Resolve All — disabled */}
              <button
                disabled
                title="Disabled until live source is connected"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-xs font-semibold cursor-not-allowed opacity-60"
              >
                <Icon name="CheckCheck" className="w-3.5 h-3.5" />
                Resolve All — disabled until live source is connected
              </button>
            </div>
          </div>

          {/* Empty state */}
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Icon name="Unplug" className="w-6 h-6 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-foreground">No provider conflicts to display</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Payroll Sync is not yet connected to a live source. No real provider conflicts are currently displayed.
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              This page will be wired later to Dentrix, Gusto, and provider mapping data. Until then, no provider sync conflicts should be treated as real.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
