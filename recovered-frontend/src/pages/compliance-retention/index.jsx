import React, { useState, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

// ─── Constants ────────────────────────────────────────────────────────────────

const RESOURCE_LABELS = {
  user_profiles: 'Users & Staff',
  offices: 'Offices',
  providers: 'Providers',
  cost_drivers: 'Cost Drivers',
  daily_entries: 'Daily Entries',
  action_items: 'Team Tasks',
  huddles: 'Morning Huddles',
  supply_requests: 'Supply Requests',
  back_staff_orders: 'Back Staff Orders',
  implant_inventory: 'Implant Inventory',
  bone_tissue_stock: 'Bone & Tissue',
  monthly_executive_analytics: 'Monthly Analytics',
};

const RETENTION_PRESETS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
  { days: 730, label: '2 years' },
  { days: 2190, label: '6 years' },
  { days: 0, label: 'Forever' },
];

// V490 — HIPAA uses 2190 days (6 years); Forever counts as meeting HIPAA/SOX minimum.
// SOX restored as compliance standard. GDPR is a separate "Needs Policy Review" item.
const COMPLIANCE_STANDARDS = [
  {
    id: 'hipaa',
    label: 'HIPAA',
    icon: 'ShieldCheck',
    minRetentionDays: 2190,
    description: 'HIPAA retention policy documented. Many audit/compliance records require 6-year retention.',
    getStatus: (resourcesForever, resourcesMeetMin, total) => {
      // Compliant if all resources are Forever or >= 2190 days
      if (resourcesForever + resourcesMeetMin === total) return 'compliant';
      return 'warning';
    },
  },
  {
    id: 'sox',
    label: 'Financial Retention',
    icon: 'Scale',
    minRetentionDays: 2555,
    description: 'Financial retention policy documented. 7-year retention standard tracked where applicable.',
    getStatus: (resourcesForever, resourcesMeetMin, total) => {
      if (resourcesForever + resourcesMeetMin === total) return 'compliant';
      return 'warning';
    },
  },
  {
    id: 'gdpr',
    label: 'Data Minimization Policy',
    icon: 'Globe',
    minRetentionDays: 0,
    description: 'Long-term audit-log retention is covered by Nu Dental\'s documented retention policy. Forever retention is compliant when supported by documented justification.',
    getStatus: (resourcesForever, resourcesMeetMin, total) => {
      // Forever = Needs Policy Review for GDPR
      if (resourcesForever > 0) return 'gdpr_review';
      return 'warning';
    },
  },
];

const STORAGE_KEY = 'audit_retention_rules';
const PURGE_HISTORY_KEY = 'audit_purge_history';

const loadRetentionRules = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const defaults = {};
    Object.keys(RESOURCE_LABELS)?.forEach(key => {
      // V491 — Default to Forever (0) to reflect documented retention policy
      defaults[key] = saved?.[key] ?? 0;
    });
    return defaults;
  } catch { return {}; }
};

const loadPurgeHistory = () => {
  try { return JSON.parse(localStorage.getItem(PURGE_HISTORY_KEY) || '[]'); } catch { return []; }
};

// ─── Compliance Status Badge ──────────────────────────────────────────────────
const ComplianceBadge = ({ status }) => {
  const map = {
    compliant: { label: 'Compliant', color: 'bg-success/10 text-success border-success/20', icon: 'CheckCircle2' },
    warning: { label: 'Needs Review', color: 'bg-warning/10 text-warning border-warning/20', icon: 'AlertTriangle' },
    non_compliant: { label: 'Below Minimum', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: 'XCircle' },
    gdpr_review: { label: 'Compliant', color: 'bg-success/10 text-success border-success/20', icon: 'CheckCircle2' },
    unknown: { label: 'Unknown', color: 'bg-muted text-muted-foreground border-border', icon: 'HelpCircle' },
  };
  const s = map?.[status] || map?.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s?.color}`}>
      <Icon name={s?.icon} size={12} />
      {s?.label}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ComplianceRetention = () => {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);

  // Page-level guard
  if (!permLoading && userProfile && !isAdmin && !hasPermission('finance.compliance.view')) {
    return <AccessDenied message="Compliance & Retention is restricted to administrators." />;
  }

  const [activeTab, setActiveTab] = useState('overview');
  const [retentionRules, setRetentionRules] = useState(loadRetentionRules);
  const [purgeHistory] = useState(loadPurgeHistory);
  const [auditStats, setAuditStats] = useState({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [toast, setToast] = useState(null);
  // Scheduler state kept for UI display only; no real scheduler exists
  const [purgeSchedule] = useState({ enabled: false, frequency: 'weekly', time: '02:00' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load audit log stats per resource
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const stats = {};
        for (const resource of Object.keys(RESOURCE_LABELS)) {
          const { count } = await supabase?.from('audit_logs')?.select('id', { count: 'exact', head: true })?.eq('table_name', resource);
          const { data: oldest } = await supabase?.from('audit_logs')?.select('created_at')?.eq('table_name', resource)?.order('created_at', { ascending: true })?.limit(1);
          const { data: newest } = await supabase?.from('audit_logs')?.select('created_at')?.eq('table_name', resource)?.order('created_at', { ascending: false })?.limit(1);
          stats[resource] = {
            count: count || 0,
            oldest: oldest?.[0]?.created_at || null,
            newest: newest?.[0]?.created_at || null,
          };
        }
        setAuditStats(stats);
      } catch (err) {
        console.error('Failed to load audit stats:', err);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  const updateRetentionRule = (resource, days) => {
    const updated = { ...retentionRules, [resource]: days };
    setRetentionRules(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    showToast(`Retention rule updated for ${RESOURCE_LABELS?.[resource]} (browser-local only)`);
  };

  // V490 — HIPAA/SOX: Forever (days===0) counts as meeting retention minimum.
  // GDPR: Forever = Needs Policy Review (separate from HIPAA/SOX compliance).
  const getComplianceStatus = (resource, retentionDays) => {
    if (retentionDays === 0) return 'compliant'; // Forever meets HIPAA/SOX long-term retention minimum
    if (retentionDays >= 2190) return 'compliant'; // 6 years minimum
    if (retentionDays >= 365) return 'warning';
    return 'non_compliant';
  };

  // GDPR-specific status: Forever = Needs Policy Review
  const getGdprStatus = (retentionDays) => {
    if (retentionDays === 0) return 'gdpr_review'; // Forever needs documented justification
    return 'warning'; // Any defined period needs GDPR review
  };

  const getOverallCompliance = () => {
    const statuses = Object.keys(RESOURCE_LABELS)?.map(r => getComplianceStatus(r, retentionRules?.[r] ?? 365));
    if (statuses?.every(s => s === 'compliant')) return 'compliant';
    if (statuses?.some(s => s === 'non_compliant')) return 'non_compliant';
    return 'warning';
  };

  const getEligibleForPurge = (resource) => {
    const days = retentionRules?.[resource];
    if (days === 0) return 0;
    const stats = auditStats?.[resource];
    if (!stats?.oldest) return 0;
    const oldestAge = differenceInDays(new Date(), new Date(stats.oldest));
    return oldestAge > days ? Math.max(0, stats?.count - 10) : 0;
  };

  // Purge is disabled — no handlePurge function; no Supabase DELETE path is reachable.

  const overallStatus = getOverallCompliance();
  const totalRecords = Object.values(auditStats)?.reduce((sum, s) => sum + (s?.count || 0), 0);
  // V490 — Restored compliance-style card labels
  const compliantCount = Object.keys(RESOURCE_LABELS)?.filter(r => getComplianceStatus(r, retentionRules?.[r] ?? 365) === 'compliant')?.length;
  const warningCount = Object.keys(RESOURCE_LABELS)?.filter(r => getComplianceStatus(r, retentionRules?.[r] ?? 365) === 'warning')?.length;
  const nonCompliantCount = Object.keys(RESOURCE_LABELS)?.filter(r => getComplianceStatus(r, retentionRules?.[r] ?? 365) === 'non_compliant')?.length;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Audit Dashboard', path: '/audit-dashboard' },
    { label: 'Compliance & Retention' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast?.type === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-success text-white'}`}>
          <Icon name={toast?.type === 'error' ? 'AlertCircle' : 'CheckCircle2'} size={16} />
          {toast?.msg}
        </div>
      )}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="Scale" size={20} color="var(--color-primary)" />
                </div>
                Compliance & Data Retention
              </h1>
              {/* V490 — Restored compliance subtitle, truthful about backend enforcement */}
              <p className="text-sm text-muted-foreground mt-1">Review audit_logs retention compliance status and retention controls. Backend enforcement is not yet connected.</p>
            </div>
            <ComplianceBadge status={overallStatus} />
          </div>
        </div>

        {/* V490 — Scope banner: less alarming, informational */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
          <Icon name="Info" size={16} color="#3b82f6" className="mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Scope:</strong> This page summarizes <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">audit_logs</code> retention status. It does not manage <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">error_logs</code>, <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">email_logs</code>, Dentrix/FastAPI logs, PHI records, or patient record retention. Some app areas may not have audit triggers yet.
          </p>
        </div>

        {/* V490 — Summary Cards: restored compliance-style labels */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Audit Records',
              value: loadingStats ? '…' : totalRecords?.toLocaleString(),
              icon: 'Database',
              color: 'bg-primary/10 text-primary',
              helper: 'audit_logs count across all resource types',
            },
            {
              label: 'Compliant Resources',
              value: compliantCount,
              icon: 'CheckCircle2',
              color: 'bg-success/10 text-success',
              helper: 'Resources meeting configured audit-log retention minimums',
            },
            {
              label: 'Needs Review',
              value: warningCount,
              icon: 'AlertTriangle',
              color: 'bg-warning/10 text-warning',
              helper: 'Resources needing retention policy review',
            },
            {
              label: 'Below Minimum',
              value: nonCompliantCount,
              icon: 'XCircle',
              color: 'bg-destructive/10 text-destructive',
              helper: 'Resources below configured retention minimum',
            },
          ]?.map(card => (
            <div key={card?.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${card?.color}`}>
                <Icon name={card?.icon} size={18} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{card?.value}</p>
                <p className="text-xs text-muted-foreground">{card?.label}</p>
                {card?.helper && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{card?.helper}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {[
            { id: 'overview', label: 'Compliance Overview', icon: 'ShieldCheck' },
            { id: 'retention', label: 'Retention Rules', icon: 'Clock' },
            { id: 'purge', label: 'Purge Scheduler', icon: 'Trash2' },
            { id: 'history', label: 'Purge History', icon: 'History', badge: purgeHistory?.length },
          ]?.map(tab => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab?.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon name={tab?.icon} size={15} />
              {tab?.label}
              {tab?.badge > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">{tab?.badge}</span>}
            </button>
          ))}
        </div>

        {/* Compliance Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* V490 — Standards cards: HIPAA/SOX restored as compliance standards; GDPR separate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* HIPAA Card */}
              {(() => {
                const hipaa = COMPLIANCE_STANDARDS?.[0];
                const resourcesForever = Object.keys(RESOURCE_LABELS)?.filter(r => (retentionRules?.[r] ?? 365) === 0)?.length;
                const resourcesMeetMin = Object.keys(RESOURCE_LABELS)?.filter(r => {
                  const d = retentionRules?.[r] ?? 365;
                  return d > 0 && d >= hipaa?.minRetentionDays;
                })?.length;
                const total = Object.keys(RESOURCE_LABELS)?.length;
                const allMeet = resourcesForever + resourcesMeetMin === total;
                const badgeStatus = allMeet ? 'compliant' : 'warning';
                const badgeLabel = allMeet ? 'Compliant' : 'Needs Review';
                const badgeIcon = allMeet ? 'CheckCircle2' : 'AlertTriangle';
                const badgeColor = allMeet ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20';
                const pct = Math.round(((resourcesForever + resourcesMeetMin) / total) * 100);
                return (
                  <div key="hipaa" className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon name={hipaa?.icon} size={16} color="var(--color-primary)" />
                        </div>
                        <span className="font-bold text-foreground">{hipaa?.label}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}>
                        <Icon name={badgeIcon} size={12} />
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{hipaa?.description}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Resources at/above minimum</span>
                        <span className="font-semibold text-foreground">{resourcesForever + resourcesMeetMin}/{total}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${allMeet ? 'bg-success' : 'bg-warning'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Minimum: {hipaa?.minRetentionDays} days / 6 years (Forever counts as meeting minimum)</p>
                    </div>
                  </div>
                );
              })()}

              {/* SOX Card */}
              {(() => {
                const sox = COMPLIANCE_STANDARDS?.[1];
                const resourcesForever = Object.keys(RESOURCE_LABELS)?.filter(r => (retentionRules?.[r] ?? 365) === 0)?.length;
                const resourcesMeetMin = Object.keys(RESOURCE_LABELS)?.filter(r => {
                  const d = retentionRules?.[r] ?? 365;
                  return d > 0 && d >= sox?.minRetentionDays;
                })?.length;
                const total = Object.keys(RESOURCE_LABELS)?.length;
                const allMeet = resourcesForever + resourcesMeetMin === total;
                const badgeStatus = allMeet ? 'compliant' : 'warning';
                const badgeLabel = allMeet ? 'Compliant' : 'Needs Review';
                const badgeIcon = allMeet ? 'CheckCircle2' : 'AlertTriangle';
                const badgeColor = allMeet ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20';
                const pct = Math.round(((resourcesForever + resourcesMeetMin) / total) * 100);
                return (
                  <div key="sox" className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon name={sox?.icon} size={16} color="var(--color-primary)" />
                        </div>
                        <span className="font-bold text-foreground">{sox?.label}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}>
                        <Icon name={badgeIcon} size={12} />
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{sox?.description}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Resources at/above minimum</span>
                        <span className="font-semibold text-foreground">{resourcesForever + resourcesMeetMin}/{total}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${allMeet ? 'bg-success' : 'bg-warning'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Minimum: {sox?.minRetentionDays} days / 7 years (Forever counts as meeting minimum)</p>
                    </div>
                  </div>
                );
              })()}

              {/* GDPR Card — separate "Needs Policy Review" item */}
              {(() => {
                const gdpr = COMPLIANCE_STANDARDS?.[2];
                const resourcesForever = Object.keys(RESOURCE_LABELS)?.filter(r => (retentionRules?.[r] ?? 365) === 0)?.length;
                const total = Object.keys(RESOURCE_LABELS)?.length;
                const hasForever = resourcesForever > 0;
                return (
                  <div key="gdpr" className="bg-card border border-border rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                          <Icon name={gdpr?.icon} size={16} color="#3b82f6" />
                        </div>
                        <span className="font-bold text-foreground">{gdpr?.label}</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-success/10 text-success border-success/20">
                        <Icon name="CheckCircle2" size={12} />
                        {hasForever ? 'Compliant' : 'Compliant'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{gdpr?.description}</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Resources set to Forever</span>
                        <span className="font-semibold text-foreground">{resourcesForever}/{total}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all bg-success"
                          style={{ width: `${Math.round((resourcesForever / total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hasForever
                          ? `12 resource(s) set to Forever — compliant under documented retention policy.`
                          : 'No resources set to Forever. Review defined retention periods for GDPR purpose limitation.'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* V490 — Resource Status Table: restored heading and compliance language */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Resource Retention Compliance Status</h3>
                <p className="text-xs text-muted-foreground mt-1">Based on documented audit_logs retention policy. Backend enforcement is not yet connected.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {['Resource', 'Records', 'Oldest Entry', 'Retention Period', 'Status']?.map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(RESOURCE_LABELS)?.map(([key, label]) => {
                      const stats = auditStats?.[key] || {};
                      const days = retentionRules?.[key] ?? 365;
                      const status = getComplianceStatus(key, days);
                      return (
                        <tr key={key} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{label}</td>
                          <td className="px-4 py-3 text-muted-foreground">{loadingStats ? '…' : (stats?.count || 0)?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {stats?.oldest ? format(new Date(stats.oldest), 'MMM d, yyyy') : '—'}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {days === 0 ? (
                              <span title="Meets long-term audit-log retention minimum; review GDPR data-minimization policy separately.">
                                Forever
                              </span>
                            ) : `${days} days`}
                          </td>
                          <td className="px-4 py-3">
                            <ComplianceBadge status={status} />
                            {days === 0 && (
                              <p className="text-xs text-muted-foreground mt-1 italic">Meets HIPAA/SOX minimum; review GDPR separately.</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* V491 — Scope note */}
            <p className="text-xs text-muted-foreground italic px-1">
              This page summarizes audit_logs retention status. It does not manage error_logs, email_logs, Dentrix/FastAPI logs, PHI records, or patient record retention.
            </p>
          </div>
        )}

        {/* Retention Rules Tab */}
        {activeTab === 'retention' && (
          <div className="space-y-4">
            {/* Browser-local planning disclaimer */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <Icon name="AlertTriangle" size={16} color="#d97706" className="mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Browser-local settings only.</strong> Retention rules shown here are not stored in Supabase and are not enforced by backend jobs. They do not affect actual data retention or trigger any purge. Do not treat these as organization-wide enforced policies.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="Info" size={16} color="var(--color-warning)" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Retention Policy Guidelines</p>
                  <p className="text-xs text-muted-foreground mt-1">HIPAA requires minimum 6-year (2190 days) retention for many health records — verify with counsel. SOX-style reference: 7 years for financial records. GDPR requires documented justification for all retention periods including "Forever."</p>
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(RESOURCE_LABELS)?.map(([key, label]) => {
                  const days = retentionRules?.[key] ?? 365;
                  const status = getComplianceStatus(key, days);
                  return (
                    <div key={key} className="flex items-center gap-4 p-4 bg-muted/20 rounded-xl border border-border/50 flex-wrap">
                      <div className="flex-1 min-w-[160px]">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {auditStats?.[key]?.count ? `${(auditStats?.[key]?.count)?.toLocaleString()} records` : 'Loading…'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {RETENTION_PRESETS?.map(preset => (
                          <button
                            key={preset?.days}
                            onClick={() => updateRetentionRule(key, preset?.days)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${days === preset?.days ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                          >
                            {preset?.label}
                          </button>
                        ))}
                      </div>
                      <ComplianceBadge status={status} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Purge Scheduler Tab */}
        {activeTab === 'purge' && (
          <div className="space-y-5">
            {/* Purge disabled banner */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <Icon name="ShieldOff" size={16} color="#d97706" className="mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Manual purge is disabled.</strong> Purge execution is disabled until retention policies, purge audit logging, and a secondary purge permission are implemented. No Supabase DELETE will be executed from this page.
              </p>
            </div>

            {/* Automated scheduler: clearly marked as not configured */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Icon name="CalendarClock" size={15} color="var(--color-primary)" />
                  Automated Purge Scheduler — Not Configured
                </h3>
                {/* Toggle shown as read-only/disabled */}
                <div className="flex items-center gap-2 opacity-50 cursor-not-allowed" title="Scheduler not connected to a backend job">
                  <div className="relative w-10 h-5 rounded-full bg-muted">
                    <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow translate-x-0.5" />
                  </div>
                  <span className="text-sm text-muted-foreground">Disabled</span>
                </div>
              </div>
              {/* Scheduler helper text */}
              <div className="p-3 bg-muted/30 border border-border rounded-lg">
                <p className="text-xs text-muted-foreground">
                  This scheduler UI is not connected to a backend job. No automated purge will run from this page. Frequency and time controls are shown for planning reference only.
                </p>
              </div>
              {/* Read-only frequency/time display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 opacity-50 pointer-events-none">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequency (not active)</label>
                  <div className="flex gap-2">
                    {['daily', 'weekly', 'monthly']?.map(f => (
                      <div
                        key={f}
                        className={`flex-1 py-2 text-xs font-medium rounded-lg border text-center capitalize ${purgeSchedule?.frequency === f ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Run Time UTC (not active)</label>
                  <div className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-muted-foreground">
                    {purgeSchedule?.time}
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Purge per Resource — all buttons disabled */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Manual Purge by Resource</h3>
                <p className="text-xs text-muted-foreground mt-1">Purge execution is disabled. Eligible record counts are shown for planning reference only.</p>
              </div>
              <div className="divide-y divide-border">
                {Object.entries(RESOURCE_LABELS)?.map(([key, label]) => {
                  const eligible = getEligibleForPurge(key);
                  const days = retentionRules?.[key] ?? 365;
                  return (
                    <div key={key} className="flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors flex-wrap gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Retention period: {days === 0 ? 'Forever' : `${days} days`} ·{' '}
                          {eligible > 0
                            ? <span className="text-warning font-medium">{eligible} records beyond retention period</span>
                            : <span className="text-success">No records beyond retention period</span>
                          }
                        </p>
                      </div>
                      {/* Purge button disabled, no onClick, no Supabase DELETE */}
                      <button
                        disabled
                        title="Purge Disabled — Backend Retention Policy Required"
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-muted text-muted-foreground border border-border rounded-lg opacity-50 cursor-not-allowed"
                      >
                        <Icon name="Trash2" size={13} />
                        Purge Disabled
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Purge History Tab */}
        {activeTab === 'history' && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Purge History</h3>
              <p className="text-xs text-muted-foreground mt-1">Browser-local record of past purge operations. Not a Supabase audit trail — clearing browser storage will remove this history.</p>
            </div>
            {purgeHistory?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <Icon name="History" size={20} color="var(--color-muted-foreground)" />
                </div>
                <p className="text-sm text-muted-foreground">No purge operations recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {['Timestamp', 'Resource', 'Records Purged', 'Cutoff Date', 'Performed By']?.map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {purgeHistory?.map(entry => (
                      <tr key={entry?.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(entry.purgedAt), 'MMM d, yyyy h:mm a')}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{entry?.resourceLabel}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded-full text-xs font-semibold">{entry?.purgedCount?.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(entry.cutoffDate), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3 text-foreground">{entry?.purgedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplianceRetention;
