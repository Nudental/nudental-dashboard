import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import OfficesManagement from './OfficesManagement';
import ProvidersManagement from './ProvidersManagement';
import UsersManagement from './UsersManagement';
import CostDriversManagement from './CostDriversManagement';
import BackStaffOrdersManagement from './BackStaffOrdersManagement';
import AuditTrailManagement from './AuditTrailManagement';
import EmailLogsManagement from './EmailLogsManagement';
import GoalsManagement from './GoalsManagement';
import ServiceCategoriesManagement from './ServiceCategoriesManagement';
import ServiceCategoryGoalsManagement from './ServiceCategoryGoalsManagement';
import ReviewPendingEntities from './components/ReviewPendingEntities';

const SECTIONS = [
  {
    id: 'offices',
    label: 'Offices',
    icon: 'Building2',
    group: 'Entity Management',
    description: 'Manage office locations and contact details',
  },
  {
    id: 'providers',
    label: 'Providers',
    icon: 'Stethoscope',
    group: 'Entity Management',
    description: 'Manage doctors and hygienists',
  },
  {
    id: 'users',
    label: 'Users & Staff',
    icon: 'Users',
    group: 'Entity Management',
    description: 'Invite staff and manage roles',
  },
  {
    id: 'cost-drivers',
    label: 'Cost Drivers',
    icon: 'DollarSign',
    group: 'Financial Categories',
    description: 'Payroll and payment categories',
  },
  {
    id: 'back-staff-orders',
    label: 'Back Staff Orders',
    icon: 'ShoppingCart',
    group: 'Financial Categories',
    description: 'Vendor and expense categories',
  },
  {
    id: 'service-categories',
    label: 'Service Categories',
    icon: 'Layers',
    group: 'Financial Categories',
    description: 'Dental service types (Implants, Botox, etc.)',
  },
  {
    id: 'set-goals',
    label: 'Set Goals',
    icon: 'Target',
    group: 'Goals',
    description: 'Monthly collection targets per office',
  },
  {
    id: 'service-category-goals',
    label: 'Service Category Goals',
    icon: 'BarChart2',
    group: 'Goals',
    description: 'Service-level goals with 15% growth seeding',
  },
  {
    id: 'review-pending',
    label: 'Review Pending Entities',
    icon: 'Zap',
    group: 'Import Management',
    description: 'Review auto-created providers & categories',
  },
  {
    id: 'email-logs',
    label: 'Email Logs',
    icon: 'Mail',
    group: 'Communications',
    description: 'View sent and failed email events',
  },
  {
    id: 'audit-trail',
    label: 'Audit Trail',
    icon: 'ClipboardList',
    group: 'System',
    description: 'View all system changes and activity',
  },
];

const SECTION_GROUPS = ['Entity Management', 'Financial Categories', 'Goals', 'Import Management', 'Communications', 'System'];

const ManagementSettings = () => {
  const { userProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('offices');

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Management & Settings' },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Super Admin guard
  if (userProfile && userProfile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Icon name="ShieldOff" size={32} color="var(--color-destructive)" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground text-center max-w-sm">
            This section is restricted to Super Administrators only.
          </p>
          <button
            onClick={() => navigate('/executive-overview')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const activeItem = SECTIONS?.find(s => s?.id === activeSection);

  const renderContent = () => {
    switch (activeSection) {
      case 'offices': return <OfficesManagement />;
      case 'providers': return <ProvidersManagement />;
      case 'users': return <UsersManagement />;
      case 'cost-drivers': return <CostDriversManagement />;
      case 'back-staff-orders': return <BackStaffOrdersManagement />;
      case 'service-categories': return <ServiceCategoriesManagement />;
      case 'set-goals': return <GoalsManagement />;
      case 'service-category-goals': return <ServiceCategoryGoalsManagement />;
      case 'review-pending': return <ReviewPendingEntities />;
      case 'email-logs': return <EmailLogsManagement />;
      case 'audit-trail': return <AuditTrailManagement />;
      default: return <OfficesManagement />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <main className="main-content">
        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="Settings" size={18} color="var(--color-primary)" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Management & Settings</h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                Super Admin Only
              </span>
            </div>
            <p className="text-sm text-muted-foreground ml-11">
              Configure offices, providers, users, and financial categories for the NU Dental system.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-64 flex-shrink-0">
              <nav className="bg-card border border-border rounded-lg overflow-hidden">
                {SECTION_GROUPS?.map((group) => (
                  <div key={group}>
                    <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group}
                      </span>
                    </div>
                    {SECTIONS?.filter(s => s?.group === group)?.map((section) => (
                      <button
                        key={section?.id}
                        onClick={() => setActiveSection(section?.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 last:border-b-0 ${
                          activeSection === section?.id
                            ? 'bg-primary/5 text-primary border-l-2 border-l-primary' :'text-foreground hover:bg-muted/50'
                        }`}
                      >
                        <Icon
                          name={section?.icon}
                          size={16}
                          color={activeSection === section?.id ? 'var(--color-primary)' : 'currentColor'}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{section?.label}</div>
                          <div className="text-xs text-muted-foreground truncate">{section?.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-4">
                <Icon name={activeItem?.icon || 'Settings'} size={20} color="var(--color-primary)" />
                <h2 className="text-lg font-semibold text-foreground">{activeItem?.label}</h2>
                <span className="text-sm text-muted-foreground">— {activeItem?.description}</span>
              </div>
              {renderContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagementSettings;
