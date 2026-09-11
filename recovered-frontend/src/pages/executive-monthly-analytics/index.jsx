import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import DataEntryForm from './components/DataEntryForm';
import ExecutiveSummaryTab from './components/ExecutiveSummaryTab';
import CSVImportExport from './components/CSVImportExport';
import YearComparisonPanel from '../../components/YearComparisonPanel';
import { AccessDenied } from '../../hooks/useRbacGuard';

const TABS = [
  { id: 'summary',       label: 'Executive Summary',      icon: 'BarChart2' },
  { id: 'import-export', label: 'Legacy Import / Export', icon: 'FileSpreadsheet' },
  { id: 'data-entry',    label: 'Legacy Manual Override', icon: 'ClipboardList' },
];

const ExecutiveMonthlyAnalytics = () => {
  const { userProfile, loading: authLoading, profileLoading } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const isRegional = userProfile?.role === 'regional_manager' || userProfile?.role === 'regional_clinical_manager';
  const isOfficeManager = userProfile?.role === 'office_manager';
  const isStaff = userProfile?.role === 'staff';

  const canAccess = isSuperAdmin || isAdmin || isRegional || isOfficeManager;
  const canEdit = isSuperAdmin || isAdmin || isRegional || isOfficeManager;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Executive Monthly Analytics' },
  ];

  // Permission gate — replace navigate redirect with AccessDenied panel
  if (!authLoading && !profileLoading && !permLoading && userProfile) {
    const hasMonthlyTrendsPermission = hasPermission('performance.monthly_trends.view');
    if (!canAccess && !hasMonthlyTrendsPermission) {
      return <AccessDenied message="Monthly Analytics is restricted. Contact your administrator to request access." />;
    }
  }

  if (authLoading || profileLoading || permLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="Loader" size={28} color="var(--color-primary)" className="animate-spin" />
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb items={breadcrumbItems} />

        {/* Page Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Executive Monthly Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeTab === 'summary' ?'Automated monthly summary from verified Dentrix/FastAPI and reconciled AR snapshot sources.' :'Monthly performance trends with automated Executive Summary and legacy manual override tools.'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 opacity-75">
              {activeTab === 'summary' ?'Automated summary — not sourced from monthly_executive_analytics.' :'Legacy monthly_executive_analytics records — manual, CSV-imported, or EOD-approved; not live Dentrix actuals.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
              {userProfile?.role?.replace(/_/g, ' ')?.replace(/\b\w/g, (c) => c?.toUpperCase())}
            </span>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
          {TABS?.map((tab) => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab?.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon name={tab?.icon} size={15} />
              {tab?.label}
            </button>
          ))}
        </div>

        {/* Year Comparison Panel — shown when years are selected */}
        {activeTab === 'summary' && (
          <YearComparisonPanel
            title="Year-over-Year Monthly Analytics"
          />
        )}

        {/* Tab Content */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {activeTab === 'data-entry' && (
            canEdit ? (
              <>
                {/* Legacy Manual Override notice */}
                <div className="flex items-start gap-3 px-4 py-3 mb-5 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-900/10 dark:border-amber-800/30">
                  <Icon name="AlertTriangle" size={16} color="#d97706" className="flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>Legacy Manual Override:</strong> Manual entries are for historical backfill or override only and do not power the automated Executive Summary.
                  </p>
                </div>
                <DataEntryForm onSuccess={() => setActiveTab('summary')} />
              </>
            ) : (
              <div className="text-center py-12">
                <Icon name="Lock" size={32} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">You have read-only access to this module.</p>
              </div>
            )
          )}
          {activeTab === 'summary' && <ExecutiveSummaryTab />}
          {activeTab === 'import-export' && (
            canEdit ? (
              <CSVImportExport />
            ) : (
              <div className="text-center py-12">
                <Icon name="Lock" size={32} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Import/Export requires edit permissions.</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
};

export default ExecutiveMonthlyAnalytics;
