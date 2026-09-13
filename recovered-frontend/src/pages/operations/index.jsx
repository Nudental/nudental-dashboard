import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { fetchOffices, buildDateRange, fetchLastAvailablePeriod } from '../../services/operationsService';
import OfficesTab from './components/OfficesTab';
import ProductionDetailsTab from './components/ProductionDetailsTab';
import PerformanceTab from './components/PerformanceTab';
import ProvidersTab from './components/ProvidersTab';
import TrendsTab from './components/TrendsTab';
import CancellationsTab from './components/CancellationsTab';
import ARAgingTab from './components/ARAgingTab';
import MarketingTab from './components/MarketingTab';
import ScorecardsTab from './components/ScorecardsTab';
import ServicesTab from './components/ServicesTab';
import PayorsTab from './components/PayorsTab';
import GlobalFilterBar from '../../components/GlobalFilterBar';
import ScrollableTabBar from '../../components/ui/ScrollableTabBar';
import YearComparisonPanel from '../../components/YearComparisonPanel';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

const TAB_PERMISSION_MAP = {
  offices:       'performance.operations.offices.view',
  production:    'performance.operations.production.view',
  performance:   'performance.operations.performance.view',
  providers:     'performance.operations.providers.view',
  services:      'performance.operations.services.view',
  payors:        'performance.operations.payors.view',
  trends:        'performance.operations.trends.view',
  cancellations: 'performance.operations.cancellations.view',
  ar_aging:      'performance.operations.ar_aging.view',
  marketing:     'performance.operations.marketing.view',
  scorecards:    'performance.operations.scorecards.view',
};

const ALL_TAB_PERMISSION_KEYS = Object.values(TAB_PERMISSION_MAP);

const TABS = [
  { id: 'offices', label: 'Offices' },
  { id: 'production', label: 'Production' },
  { id: 'performance', label: 'Performance' },
  { id: 'providers', label: 'Providers' },
  { id: 'services', label: 'Services' },
  { id: 'payors', label: 'Payors' },
  { id: 'trends', label: 'Trends' },
  { id: 'cancellations', label: 'Cancellations' },
  { id: 'ar_aging', label: 'Claims / AR' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'scorecards', label: 'Scorecards' },
];

const DATE_PRESETS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
];

const ALLOWED_ROLES = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'];

const OperationsCenter = () => {
  const { userProfile, loading: authLoading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Page-level access: super_admin always allowed; otherwise require performance.operations.view OR any tab permission
  const hasPageAccess = React.useMemo(() => {
    if (isSuperAdmin) return true;
    if (hasPermission('performance.operations.view')) return true;
    return ALL_TAB_PERMISSION_KEYS?.some(key => hasPermission(key));
  }, [isSuperAdmin, hasPermission, permLoading]);

  // Compute allowed tabs based on permissions
  const allowedTabs = React.useMemo(() => {
    if (isSuperAdmin) return TABS;
    return TABS?.filter(tab => hasPermission(TAB_PERMISSION_MAP?.[tab?.id]));
  }, [isSuperAdmin, hasPermission, permLoading]);

  const [activeTab, setActiveTab] = useState('offices');
  const [datePreset, setDatePreset] = useState('last_month');
  const [offices, setOffices] = useState([]);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);
  const [lastAvailablePeriod, setLastAvailablePeriod] = useState(null);
  const [noDataWarning, setNoDataWarning] = useState(null);

  // Global filter bar state
  const [globalFilters, setGlobalFilters] = useState({
    datePreset: 'last_month',
    selectedOfficeIds: [],
    lineOfBusiness: [],
    viewBy: 'location',
  });

  // Build date range — if "this_month" selected but no data, fall back to last available period
  const now = new Date();
  const thisMonthRange = buildDateRange('this_month');
  const baseRange = buildDateRange(datePreset, globalFilters?.customStartDate, globalFilters?.customEndDate);

  // Effective date range: if this_month selected and last available period is earlier, use that
  const effectiveDateRange = (() => {
    if (datePreset === 'this_month' && lastAvailablePeriod) {
      const thisMonthVal = thisMonthRange?.startYear * 100 + thisMonthRange?.startMonth;
      const lastAvailVal = lastAvailablePeriod?.year * 100 + lastAvailablePeriod?.month;
      if (lastAvailVal < thisMonthVal) {
        return {
          startYear: lastAvailablePeriod?.year,
          startMonth: lastAvailablePeriod?.month,
          endYear: lastAvailablePeriod?.year,
          endMonth: lastAvailablePeriod?.month,
        };
      }
    }
    return baseRange;
  })();

  // Role guard — redirect unauthenticated users only; access denial handled by AccessDenied panel
  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!userProfile) { navigate('/login', { replace: true }); return; }
  }, [authLoading, profileLoading, userProfile, navigate]);

  // Switch to first allowed tab if current tab is restricted
  useEffect(() => {
    if (permLoading || isSuperAdmin) return;
    if (allowedTabs?.length > 0 && !allowedTabs?.find(t => t?.id === activeTab)) {
      setActiveTab(allowedTabs?.[0]?.id);
    }
  }, [allowedTabs, activeTab, permLoading, isSuperAdmin]);

  // Load offices + detect last available period
  useEffect(() => {
    const load = async () => {
      try {
        const [officeData, lastPeriod] = await Promise.all([
          fetchOffices(),
          fetchLastAvailablePeriod(),
        ]);
        setOffices(officeData || []);
        setLastAvailablePeriod(lastPeriod || null);
      } catch (e) {
        console.error('Failed to load offices/period:', e);
      } finally {
        setOfficesLoading(false);
      }
    };
    load();
  }, []);

  // Show warning when "This Month" is selected but no data exists yet
  useEffect(() => {
    if (datePreset === 'this_month' && lastAvailablePeriod) {
      const thisMonthVal = thisMonthRange?.startYear * 100 + thisMonthRange?.startMonth;
      const lastAvailVal = lastAvailablePeriod?.year * 100 + lastAvailablePeriod?.month;
      if (lastAvailVal < thisMonthVal) {
        setNoDataWarning(`No data yet for this month. Showing last available period (${lastAvailablePeriod?.label}).`);
      } else {
        setNoDataWarning(null);
      }
    } else {
      setNoDataWarning(null);
    }
  }, [datePreset, lastAvailablePeriod]);

  const toggleOffice = (id) => {
    setSelectedOfficeIds((prev) =>
      prev?.includes(id) ? prev?.filter((x) => x !== id) : [...prev, id]
    );
  };

  const officeLabel = selectedOfficeIds?.length === 0
    ? 'All Offices'
    : selectedOfficeIds?.length === 1
      ? offices?.find((o) => o?.id === selectedOfficeIds?.[0])?.name || '1 Office'
      : `${selectedOfficeIds?.length} Offices`;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Operations Center' },
  ];

  const tabProps = {
    dateRange: effectiveDateRange,
    officeIds: selectedOfficeIds,
    offices,
    lastAvailablePeriod,
  };

  if (authLoading || profileLoading || permLoading) {
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
        <main className="main-content">
          <AccessDenied
            title="Operations Access Restricted"
            message="You don't have permission to view the Operations Center. Contact your administrator to request access."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        <Breadcrumb items={breadcrumbItems} />

        {/* Page Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Lexend, sans-serif' }}>
                Operations Center
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Comprehensive operational analytics across all offices
              </p>
            </div>
          </div>

          {/* Global Filter Bar */}
          <div className="mt-3">
            <GlobalFilterBar
              allowProviderType={false}
              offices={offices}
              filters={globalFilters}
              onFiltersChange={(newFilters) => {
                setGlobalFilters(newFilters);
                setDatePreset(newFilters?.datePreset || 'last_month');
                setSelectedOfficeIds(newFilters?.selectedOfficeIds || []);
              }}
            />
          </div>

          {/* No-data warning banner */}
          {noDataWarning && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <Icon name="AlertTriangle" size={16} className="flex-shrink-0 text-amber-500" />
              {noDataWarning}
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="bg-card border-b border-border">
          <ScrollableTabBar
            tabs={allowedTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            variant="primary"
            className="px-4 sm:px-6"
          />
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {baseRange?.error ? (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{baseRange.error}</div>
          ) : <>
          {/* Year Comparison Panel — shown above all tabs when years are selected */}
          <YearComparisonPanel
            officeIds={selectedOfficeIds}
            title="Year-over-Year Operations Comparison"
            compact={true}
          />
          {allowedTabs?.length === 0 && !permLoading && (
            <AccessDenied message="No Operations tabs are enabled for your role. Contact your administrator." />
          )}
          {activeTab === 'offices' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.offices)) && <OfficesTab {...tabProps} />}
          {activeTab === 'production' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.production)) && <ProductionDetailsTab {...tabProps} />}
          {activeTab === 'performance' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.performance)) && <PerformanceTab {...tabProps} />}
          {activeTab === 'providers' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.providers)) && <ProvidersTab {...tabProps} />}
          {activeTab === 'services' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.services)) && <ServicesTab {...tabProps} />}
          {activeTab === 'payors' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.payors)) && <PayorsTab {...tabProps} />}
          {activeTab === 'trends' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.trends)) && <TrendsTab {...tabProps} />}
          {activeTab === 'cancellations' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.cancellations)) && <CancellationsTab {...tabProps} />}
          {activeTab === 'ar_aging' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.ar_aging)) && <ARAgingTab {...tabProps} />}
          {activeTab === 'marketing' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.marketing)) && <MarketingTab {...tabProps} />}
          {activeTab === 'scorecards' && (isSuperAdmin || hasPermission(TAB_PERMISSION_MAP?.scorecards)) && <ScorecardsTab {...tabProps} lastAvailablePeriod={lastAvailablePeriod} />}
          </>}
        </div>
      </main>
    </div>
  );
};

export default OperationsCenter;
