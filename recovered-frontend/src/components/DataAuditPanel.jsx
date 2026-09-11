/**
 * DataAuditPanel.jsx
 * ══════════════════════════════════════════════════════════════════════════════
 * Super Admin-only Data Lineage & Audit Panel
 *
 * Shows:
 * - Metric-by-metric data lineage (source, endpoint, transformation)
 * - Cross-tab reconciliation status
 * - Missing data detection
 * - Office normalization warnings
 * - Endpoint liveness
 * - Last sync times per metric
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback } from 'react';
import Icon from './AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { METRIC_LINEAGE, fetchCanonicalKPIs, buildDateRange } from '../services/metricsService';
import { getUnmatchedOfficeDiagnostics } from '../utils/officeNormalizer';
import { fetchConflicts, validateAllEndpoints } from '../services/ascendSyncService';
import { OFFICE_LIST } from '../constants/offices';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCurrency = (v) => {
  const n = parseFloat(v);
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};

const fmtRelative = (iso) => {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─── Status Chip ──────────────────────────────────────────────────────────────

const Chip = ({ label, color = 'slate' }) => {
  const colors = {
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors?.[color] || colors?.slate}`}>
      {label}
    </span>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────

const SectionHeader = ({ icon, title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <Icon name={icon} className="w-4 h-4 text-indigo-500" />
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// ─── Metric Lineage Table ─────────────────────────────────────────────────────

const MetricLineageTable = () => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200">
          <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Metric</th>
          <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Source</th>
          <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Endpoint / Table</th>
          <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Field</th>
          <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Displayed In</th>
          <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {METRIC_LINEAGE?.map((m) => (
          <tr key={m?.key} className="hover:bg-slate-50 transition-colors">
            <td className="px-3 py-2.5 font-medium text-slate-800">{m?.label}</td>
            <td className="px-3 py-2.5">
              <Chip label={m?.source} color={m?.source === 'Ascend API' ? 'blue' : 'purple'} />
            </td>
            <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px]">{m?.endpoint}</td>
            <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px]">{m?.field}</td>
            <td className="px-3 py-2.5">
              <div className="flex flex-wrap gap-1">
                {m?.displayedIn?.slice(0, 3)?.map((tab) => (
                  <Chip key={tab} label={tab} color="slate" />
                ))}
                {m?.displayedIn?.length > 3 && (
                  <Chip label={`+${m?.displayedIn?.length - 3} more`} color="slate" />
                )}
              </div>
            </td>
            <td className="px-3 py-2.5 text-slate-500 max-w-xs">{m?.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Cross-Tab Reconciliation Panel ──────────────────────────────────────────

const CrossTabReconciliation = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = buildDateRange('last_month');

      // Fetch KPIs with no office filter (all offices)
      const allOfficeKPIs = await fetchCanonicalKPIs({ startDate, endDate, officeIds: [] });

      // Fetch per-office and sum manually to verify roll-up
      const perOfficeResults = await Promise.allSettled(
        OFFICE_LIST?.map(async (office) => {
          const kpis = await fetchCanonicalKPIs({ startDate, endDate, officeIds: [office?.id] });
          return { officeId: office?.id, officeName: office?.name, kpis };
        })
      );

      const perOffice = perOfficeResults?.filter((r) => r?.status === 'fulfilled')?.map((r) => r?.value);

      // Sum per-office totals
      const summedProduction = perOffice?.reduce((s, o) => s + (o?.kpis?.grossProduction || 0), 0);
      const summedCollections = perOffice?.reduce((s, o) => s + (o?.kpis?.collections || 0), 0);
      const summedNewPatients = perOffice?.reduce((s, o) => s + (o?.kpis?.newPatients || 0), 0);

      const allOfficeProd = allOfficeKPIs?.grossProduction || 0;
      const allOfficeColl = allOfficeKPIs?.collections || 0;
      const allOfficeNP = allOfficeKPIs?.newPatients || 0;

      const prodDiff = Math.abs(allOfficeProd - summedProduction);
      const collDiff = Math.abs(allOfficeColl - summedCollections);
      const npDiff = Math.abs(allOfficeNP - summedNewPatients);

      setResults({
        period: `${startDate} – ${endDate}`,
        allOffice: { production: allOfficeProd, collections: allOfficeColl, newPatients: allOfficeNP },
        summedPerOffice: { production: summedProduction, collections: summedCollections, newPatients: summedNewPatients },
        diffs: { production: prodDiff, collections: collDiff, newPatients: npDiff },
        perOffice,
        diagnostics: allOfficeKPIs?._diagnostics,
      });
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const diffColor = (diff, base) => {
    if (base === 0) return 'slate';
    const pct = diff / base;
    if (pct < 0.001) return 'green';
    if (pct < 0.05) return 'amber';
    return 'red';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          Verifies that all-office totals match the sum of per-office totals from the Ascend API.
        </p>
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Icon name={loading ? 'RefreshCw' : 'Play'} className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running…' : 'Run Check'}
        </button>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 mb-3">
          Error: {error}
        </div>
      )}
      {results && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Period: <span className="font-mono">{results?.period}</span></p>

          {/* Summary comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Metric</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500">All-Office API</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500">Sum of Per-Office</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500">Diff</th>
                  <th className="text-center px-3 py-2 font-semibold text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { label: 'Gross Production', key: 'production', fmt: fmtCurrency },
                  { label: 'Collections', key: 'collections', fmt: fmtCurrency },
                  { label: 'New Patients', key: 'newPatients', fmt: (v) => v?.toLocaleString() },
                ]?.map(({ label, key, fmt }) => {
                  const all = results?.allOffice?.[key];
                  const sum = results?.summedPerOffice?.[key];
                  const diff = results?.diffs?.[key];
                  const color = diffColor(diff, Math.max(all, sum, 1));
                  return (
                    <tr key={key} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">{label}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt(all)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt(sum)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-500">{fmt(diff)}</td>
                      <td className="px-3 py-2 text-center">
                        <Chip
                          label={color === 'green' ? '✓ Reconciled' : color === 'amber' ? '⚠ Minor diff' : '✗ Mismatch'}
                          color={color}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Per-office breakdown */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Per-Office Breakdown</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {results?.perOffice?.map((o) => (
                <div key={o?.officeId} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-1">{o?.officeName}</p>
                  <p className="text-xs text-slate-500">Prod: <span className="font-mono text-slate-700">{fmtCurrency(o?.kpis?.grossProduction)}</span></p>
                  <p className="text-xs text-slate-500">Coll: <span className="font-mono text-slate-700">{fmtCurrency(o?.kpis?.collections)}</span></p>
                  <p className="text-xs text-slate-500">NP: <span className="font-mono text-slate-700">{o?.kpis?.newPatients ?? 0}</span></p>
                  {o?.kpis?._error && (
                    <p className="text-xs text-red-600 mt-1 truncate" title={o?.kpis?._error}>⚠ {o?.kpis?._error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* API diagnostics */}
          {results?.diagnostics && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-xs font-semibold text-slate-500 mb-1">API Diagnostics</p>
              <div className="flex flex-wrap gap-2">
                {results?.diagnostics?.endpoints?.map((ep) => (
                  <Chip key={ep?.key} label={`${ep?.key}: ${ep?.status}`} color={ep?.status === 'ok' ? 'green' : 'red'} />
                ))}
              </div>
              {results?.diagnostics?.errors?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {results?.diagnostics?.errors?.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">⚠ {e?.key}: {e?.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {!results && !loading && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Click "Run Check" to verify cross-tab metric consistency
        </div>
      )}
    </div>
  );
};

// ─── Office Normalization Warnings ────────────────────────────────────────────

const OfficeNormalizationWarnings = () => {
  const [warnings, setWarnings] = useState([]);

  useEffect(() => {
    // Collect any unmatched office values logged since page load
    const unmatched = getUnmatchedOfficeDiagnostics();
    setWarnings(unmatched);
  }, []);

  if (warnings?.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-sm">
        <Icon name="CheckCircle2" className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        No unmatched office values detected since page load
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2 font-semibold text-slate-500">Raw Value</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-500">Source</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-500">Page</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-500">Fail Reason</th>
            <th className="text-left px-3 py-2 font-semibold text-slate-500">Timestamp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {warnings?.map((w, i) => (
            <tr key={i} className="hover:bg-red-50">
              <td className="px-3 py-2 font-mono text-red-700">{w?.rawValue || '(empty)'}</td>
              <td className="px-3 py-2 text-slate-600">{w?.source}</td>
              <td className="px-3 py-2 text-slate-600">{w?.sourcePage}</td>
              <td className="px-3 py-2 text-amber-700">{w?.failReason}</td>
              <td className="px-3 py-2 text-slate-400 font-mono">{w?.timestamp?.slice(11, 19)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Endpoint Liveness Panel ──────────────────────────────────────────────────

const EndpointLiveness = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const runValidation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await validateAllEndpoints();
      setResults(res);
    } catch (err) {
      setResults([{ endpointKey: 'error', health: 'failing', error: err?.message }]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">Test all Dentrix Ascend API endpoints for liveness.</p>
        <button
          onClick={runValidation}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <Icon name={loading ? 'RefreshCw' : 'Zap'} className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Testing…' : 'Test All Endpoints'}
        </button>
      </div>
      {results && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {results?.map((r) => (
            <div
              key={r?.endpointKey}
              className={`rounded-lg border px-3 py-2 ${r?.health === 'healthy' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-700 truncate">{r?.endpointKey}</span>
                <Chip label={r?.health} color={r?.health === 'healthy' ? 'green' : 'red'} />
              </div>
              {r?.durationMs && (
                <p className="text-xs text-slate-400 mt-0.5">{r?.durationMs}ms</p>
              )}
              {r?.error && (
                <p className="text-xs text-red-600 mt-0.5 truncate" title={r?.error}>{r?.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {!results && !loading && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Click "Test All Endpoints" to check API liveness
        </div>
      )}
    </div>
  );
};

// ─── Recent Conflicts Summary ─────────────────────────────────────────────────

const RecentConflicts = () => {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConflicts({ limit: 20 })?.then(setConflicts)?.catch(() => setConflicts([]))?.finally(() => setLoading(false));
  }, []);

  const pending = conflicts?.filter((c) => c?.resolution === 'pending' || !c?.resolution);

  if (loading) return <div className="text-center py-4 text-slate-400 text-xs">Loading…</div>;

  if (conflicts?.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400 text-sm">
        <Icon name="CheckCircle2" className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
        No reconciliation conflicts found
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Chip label={`${pending?.length} pending`} color={pending?.length > 0 ? 'amber' : 'green'} />
        <Chip label={`${conflicts?.length - pending?.length} resolved`} color="green" />
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {conflicts?.slice(0, 10)?.map((c) => (
          <div key={c?.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
            c?.resolution === 'pending' || !c?.resolution ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <span className="font-medium text-slate-700">{c?.field_name}</span>
              <span className="text-slate-400 ml-2">{c?.record_date}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-blue-700">{c?.ascend_value}</span>
              <span className="text-slate-400">vs</span>
              <span className="font-mono text-slate-700">{c?.manual_value}</span>
              <Chip label={c?.resolution || 'pending'} color={c?.resolution === 'pending' || !c?.resolution ? 'amber' : 'green'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DataAuditPanel({ defaultOpen = false }) {
  const { userProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeSection, setActiveSection] = useState('lineage');

  const isSuperAdmin = userProfile?.role === 'super_admin';
  if (!isSuperAdmin) return null;

  const sections = [
    { key: 'lineage', label: 'Metric Lineage', icon: 'GitBranch' },
    { key: 'reconciliation', label: 'Cross-Tab Check', icon: 'Scale' },
    { key: 'endpoints', label: 'Endpoint Liveness', icon: 'Zap' },
    { key: 'office_warnings', label: 'Office Warnings', icon: 'AlertTriangle' },
    { key: 'conflicts', label: 'Conflicts', icon: 'AlertCircle' },
  ];

  return (
    <div className="border border-indigo-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name="ShieldCheck" className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-800">Super Admin — Data Audit & Lineage Panel</span>
          <Chip label="Super Admin Only" color="purple" />
        </div>
        <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4 text-indigo-500" />
      </button>
      {isOpen && (
        <div className="p-4">
          {/* Section tabs */}
          <div className="flex gap-1 flex-wrap mb-4 bg-slate-50 rounded-lg p-1 border border-slate-200">
            {sections?.map((s) => (
              <button
                key={s?.key}
                onClick={() => setActiveSection(s?.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeSection === s?.key
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon name={s?.icon} className="w-3.5 h-3.5" />
                {s?.label}
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="min-h-[200px]">
            {activeSection === 'lineage' && (
              <div>
                <SectionHeader
                  icon="GitBranch"
                  title="Metric Data Lineage"
                  subtitle="Source-of-truth mapping for every dashboard metric"
                  action={null}
                />
                <MetricLineageTable />
              </div>
            )}

            {activeSection === 'reconciliation' && (
              <div>
                <SectionHeader
                  icon="Scale"
                  title="Cross-Tab Reconciliation"
                  subtitle="Verify all-office totals match sum of per-office values"
                  action={null}
                />
                <CrossTabReconciliation />
              </div>
            )}

            {activeSection === 'endpoints' && (
              <div>
                <SectionHeader
                  icon="Zap"
                  title="Endpoint Liveness"
                  subtitle="Test all Dentrix Ascend API endpoints"
                  action={null}
                />
                <EndpointLiveness />
              </div>
            )}

            {activeSection === 'office_warnings' && (
              <div>
                <SectionHeader
                  icon="AlertTriangle"
                  title="Office Normalization Warnings"
                  subtitle="Unmatched office values that failed canonical resolution"
                  action={null}
                />
                <OfficeNormalizationWarnings />
              </div>
            )}

            {activeSection === 'conflicts' && (
              <div>
                <SectionHeader
                  icon="AlertCircle"
                  title="Reconciliation Conflicts"
                  subtitle="Discrepancies between Ascend API and manual entries"
                  action={null}
                />
                <RecentConflicts />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Canonical metric service: <span className="font-mono">src/services/metricsService.js</span>
            </p>
            <a
              href="/data-health"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              <Icon name="ExternalLink" className="w-3 h-3" />
              Full Data Health Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
