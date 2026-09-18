import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchRcmOffices, buildRcmDateRange } from '../../services/rcmService';
import ClaimSubmissionsTab from './components/ClaimSubmissionsTab';
import PatientBalancesTab from './components/PatientBalancesTab';

import PatientStatementsTab from './components/PatientStatementsTab';
import PosCollectionTab from './components/PosCollectionTab';
import AdjustmentTab from './components/AdjustmentTab';
import RcmDashboardTab from './components/RcmDashboardTab';
import CollectionRefundTab from './components/CollectionRefundTab';
import YearComparisonPanel from '../../components/YearComparisonPanel';
import YearPicker from '../../components/YearPicker';
import DailyComparisonTab from './components/DailyComparisonTab';
import ScrollableTabBar from '../../components/ui/ScrollableTabBar';
import RcmDiagnosticPanel from './components/RcmDiagnosticPanel';
import ArAgingTab from './components/ArAgingTab';
import EAssistDailySummaryTab from './components/EAssistDailySummaryTab';
import GuarantorReconciliationTab from './components/GuarantorReconciliationTab';
import EAssistReportsTab from './components/EAssistReportsTab';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

const ALLOWED_ROLES = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'];

const TAB_PERMISSION_MAP = {
  claims:                    'finance.rcm.claims.view',
  patient_balances:          'finance.rcm.claims.view',
  payment:                   'finance.rcm.payment.view',
  statements:                'finance.rcm.statements.view',
  pos:                       'finance.rcm.pos.view',
  adjustment:                'finance.rcm.adjustment.view',
  dashboard:                 'finance.rcm.dashboard.view',
  ar_aging:                  'finance.rcm.ar_aging.view',
  refund:                    'finance.rcm.refund.view',
  daily_comparison:          'finance.rcm.daily_comparison.view',
  eassist_daily:             'finance.rcm.eassist_daily.view',
  patient_portion_recon:     'finance.rcm.dashboard.view',
  eassist_reports:           'finance.rcm.eassist_daily.view',
};

const ALL_RCM_TAB_PERMISSION_KEYS = Object.values(TAB_PERMISSION_MAP);

const RCM_TABS = [
  { id: 'claims',                label: 'Claim Submissions' },
  { id: 'patient_balances',      label: 'Patient Balances' },
  // Payment Arrangement tab hidden — /v2/rcm/payment-arrangements does not expose true arrangement data.
  // Preserved for future rebuild when a structured arrangement source is available.
  // { id: 'payment',               label: 'Payment Arrangement' },
  { id: 'statements',            label: 'Patient AR Follow-Up' },
  { id: 'pos',                   label: 'Point of Service Collection' },
  { id: 'adjustment',            label: 'Adjustment' },
  { id: 'dashboard',             label: 'Dashboard' },
  { id: 'ar_aging',              label: 'AR Aging' },
  { id: 'refund',                label: 'Collection Refund' },
  { id: 'daily_comparison',      label: 'Daily Comparison' },
  { id: 'eassist_daily',         label: 'Dentrix Daily Summary' },
  { id: 'patient_portion_recon', label: 'Patient Portion' },
  { id: 'eassist_reports',       label: 'eAssist Reports' },
];

const DATE_PRESETS = [
  { value: 'this_month',   label: 'This Month' },
  { value: 'last_month',   label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'q1',           label: 'Q1' },
  { value: 'q2',           label: 'Q2' },
  { value: 'q3',           label: 'Q3' },
  { value: 'q4',           label: 'Q4' },
  { value: 'ytd',          label: 'YTD' },
  { value: 'custom',       label: 'Custom Range' },
];

const RcmModule = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Page-level access: super_admin always allowed; otherwise require finance.rcm.view OR any tab permission
  const hasPageAccess = React.useMemo(() => {
    if (isSuperAdmin) return true;
    if (hasPermission('finance.rcm.view')) return true;
    return ALL_RCM_TAB_PERMISSION_KEYS?.some(key => hasPermission(key));
  }, [isSuperAdmin, hasPermission, permLoading]);

  // Compute allowed tabs
  const allowedRcmTabs = useMemo(() => {
    if (isSuperAdmin) return RCM_TABS;
    return RCM_TABS?.filter(tab => hasPermission(TAB_PERMISSION_MAP?.[tab?.id]));
  }, [isSuperAdmin, hasPermission, permLoading]);

  const [activeTab, setActiveTab] = useState('claims');
  const [datePreset, setDatePreset] = useState('last_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  // Single-office selector: '' = All Offices, UUID = one office
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [offices, setOffices] = useState([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Access control — redirect unauthenticated users only; access denial handled by AccessDenied panel
  useEffect(() => {
    if (!authLoading && !userProfile) {
      navigate('/login', { replace: true });
    }
  }, [userProfile, authLoading, navigate]);

  // Switch to first allowed tab if current is restricted
  useEffect(() => {
    if (permLoading || isSuperAdmin) return;
    if (allowedRcmTabs?.length > 0 && !allowedRcmTabs?.find(t => t?.id === activeTab)) {
      setActiveTab(allowedRcmTabs?.[0]?.id);
    }
  }, [allowedRcmTabs, activeTab, permLoading, isSuperAdmin]);

  // Load offices
  useEffect(() => {
    const load = async () => {
      try {
        setOfficesLoading(true);
        const data = await fetchRcmOffices();
        setOffices(data);
      } catch (e) {
        console.error('Failed to load offices:', e);
      } finally {
        setOfficesLoading(false);
      }
    };
    load();
  }, []);

  const dateRange = useMemo(() => buildRcmDateRange(datePreset, customStart, customEnd), [datePreset, customStart, customEnd]);
  const dateRangeInvalid = Boolean(dateRange?.start && dateRange?.end && dateRange.start > dateRange.end &&
    ['claims', 'statements', 'pos', 'adjustment', 'dashboard', 'ar_aging', 'refund', 'patient_portion_recon', 'eassist_reports'].includes(activeTab));

  const handleRefresh = () => setRefreshKey(k => k + 1);

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!userProfile) return null;

  // Page-level access denied
  if (!hasPageAccess) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AccessDenied
            title="RCM Access Restricted"
            message="You don't have permission to view Revenue Cycle Management. Contact your administrator to request access."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Revenue Cycle Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Claims, payments, statements, and collections across all offices</p>
        </div>

        {/* Global Filter Bar */}
        <div className="bg-card border border-border rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
          {/* Date Range */}
          <div className="flex items-center gap-2 flex-wrap">
            <Icon name="Calendar" size={16} className="text-muted-foreground" />
            <select
              value={datePreset}
              onChange={e => setDatePreset(e?.target?.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {DATE_PRESETS?.map(p => (
                <option key={p?.value} value={p?.value}>{p?.label}</option>
              ))}
            </select>
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e?.target?.value)}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Custom range start date"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={e => setCustomEnd(e?.target?.value)}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Custom range end date"
                />
              </div>
            )}
          </div>

          {/* Single-office selector: '' = All Offices, UUID = one office */}
          <div className="flex items-center gap-2">
            <Icon name="Building2" size={16} className="text-muted-foreground" />
            <select
              value={selectedOfficeId}
              onChange={e => setSelectedOfficeId(e?.target?.value)}
              disabled={officesLoading}
              className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            >
              <option value="">All Offices</option>
              {offices?.map(o => (
                <option key={o?.id} value={o?.id}>{o?.name}</option>
              ))}
            </select>
          </div>

          {/* Date range display */}
          <span className="text-xs text-muted-foreground hidden sm:block">
            {datePreset === 'custom' && customStart && customEnd
              ? `${customStart} — ${customEnd}`
              : `${dateRange?.start} — ${dateRange?.end}`}
          </span>

          {/* Year Picker */}
          <div className="flex items-center gap-2">
            <YearPicker compact />
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="ml-auto flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            <Icon name="RefreshCw" size={14} />
            Refresh
          </button>
        </div>

        {/* Year Comparison Panel */}
        <YearComparisonPanel
          title="RCM — Year-over-Year Comparison"
          officeIds={selectedOfficeId ? [selectedOfficeId] : []}
        />

        {/* Performance Tier Legend */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Performance Tier:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Top 20%
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" />
            Mid Tier
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            Bottom 20%
          </span>
        </div>

        {/* Super Admin Diagnostic Panel */}
        {userProfile?.role === 'super_admin' && (
          <RcmDiagnosticPanel refreshKey={refreshKey} />
        )}

        {/* Tab Navigation */}
        <div className="border-b border-border mb-6">
          <ScrollableTabBar
            tabs={allowedRcmTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            variant="teal"
          />
        </div>

        {/* No tabs allowed */}
        {allowedRcmTabs?.length === 0 && !permLoading && (
          <AccessDenied message="No RCM tabs are enabled for your role. Contact your administrator." />
        )}

        {/* Tab Content */}
        {dateRangeInvalid ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Choose an end date on or after the start date.
          </div>
        ) : <div>
          {activeTab === 'claims' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.claims)) && (
            <ClaimSubmissionsTab
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
              offices={offices}
            />
          )}
          {activeTab === 'patient_balances' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.patient_balances)) && (
            <PatientBalancesTab
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
            />
          )}
          {activeTab === 'payment' && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="bg-muted border border-border rounded-xl p-8 max-w-lg">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted-foreground/10 mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h2 className="text-base font-semibold text-foreground mb-2">Payment Arrangement Reporting Disabled</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Payment Arrangement reporting is disabled. Dentrix/HS1 does not currently expose structured payment arrangement data through the connected API. This tab will be rebuilt only when a true arrangement source is available.
                </p>
              </div>
            </div>
          )}
          {activeTab === 'statements' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.statements)) && (
            <PatientStatementsTab
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
            />
          )}
          {activeTab === 'pos' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.pos)) && (
            <PosCollectionTab
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
            />
          )}
          {activeTab === 'adjustment' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.adjustment)) && (
            <AdjustmentTab
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
            />
          )}
          {activeTab === 'dashboard' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.dashboard)) && (
            <RcmDashboardTab
              key={`${selectedOfficeId || 'all'}:${dateRange?.start}:${dateRange?.end}:${refreshKey}`}
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
              offices={offices}
              onTabChange={setActiveTab}
            />
          )}
          {activeTab === 'ar_aging' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.ar_aging)) && (
            <ArAgingTab
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
              offices={offices}
            />
          )}
          {activeTab === 'refund' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.refund)) && (
            <CollectionRefundTab
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
            />
          )}
          {/* Daily Comparison — intentionally independent: has its own office/date selector */}
          {activeTab === 'daily_comparison' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.daily_comparison)) && (
            <DailyComparisonTab
              officeId={selectedOfficeId}
              offices={offices}
            />
          )}
          {/* Dentrix Daily Summary — intentionally independent: has its own report date/office picker */}
          {activeTab === 'eassist_daily' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.eassist_daily)) && (
            <EAssistDailySummaryTab
              defaultOfficeId={selectedOfficeId}
            />
          )}
          {activeTab === 'patient_portion_recon' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.patient_portion_recon)) && (
            <GuarantorReconciliationTab
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
            />
          )}
          {/* eAssist Reports — intentionally independent: uses its own office selector (excludes Staten Island) */}
          {activeTab === 'eassist_reports' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.eassist_reports)) && (
            <EAssistReportsTab
              key={`${selectedOfficeId || 'all'}:${dateRange?.start}:${dateRange?.end}`}
              dateRange={dateRange}
              officeId={selectedOfficeId}
              refreshKey={refreshKey}
            />
          )}
        </div>}
      </main>
    </div>
  );
};

export default RcmModule;
