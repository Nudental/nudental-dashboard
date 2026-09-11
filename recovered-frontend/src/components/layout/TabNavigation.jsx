import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import Reports from './pages/reports';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import useRolePermissions from '../../hooks/useRolePermissions';


const TabNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useAuth();
  const { pendingCount } = useOfflineStatus();
  const { hasPermission } = useRolePermissions();

  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const isRCM = userProfile?.role === 'regional_clinical_manager' || isSuperAdmin;
  const isRegionalManager = userProfile?.role === 'regional_manager' || isSuperAdmin;
  const canViewOperations = isSuperAdmin || isAdmin || isRCM || isRegionalManager;
  const canViewKpis = isSuperAdmin || isAdmin || isRCM || isRegionalManager;
  const canViewRcmModule = isSuperAdmin || isAdmin || isRegionalManager || isRCM;

  // Executive Overview: only show if user has explicit permission OR is super_admin
  const canViewExecutiveOverview = isSuperAdmin || hasPermission('dashboard:executive_overview');

  const tabs = [
    ...(canViewExecutiveOverview ? [{
      label: 'Executive Overview',
      path: '/executive-overview',
      icon: 'LayoutDashboard',
      description: 'Strategic dashboard for C-level financial oversight'
    }] : []),
    ...(hasPermission('performance:office_view') ? [{
      label: 'Office Performance',
      path: '/office-performance',
      icon: 'Building2',
      description: 'Operational analytics for practice managers'
    }] : []),
    ...(hasPermission('analytics:financial_view') ? [{
      label: 'Financial Analytics',
      path: '/financial-analytics',
      icon: 'TrendingUp',
      description: 'Advanced analytical tools and forecasting'
    }] : []),
    ...(isSuperAdmin || isAdmin || isRCM || userProfile?.role === 'office_manager' ? [{
      label: 'Monthly Analytics',
      path: '/executive-monthly-analytics',
      icon: 'BarChart2',
      description: 'Executive monthly financial and operational analytics'
    }] : []),
    ...(canViewOperations ? [{
      label: 'Operations',
      path: '/operations',
      icon: 'Activity',
      description: 'Comprehensive operational analytics — offices, providers, AR, marketing'
    }] : []),
    ...(canViewKpis ? [{
      label: 'KPIs',
      path: '/kpis',
      icon: 'Target',
      description: 'Key performance indicators — production, collections, patients, goals'
    }] : []),
    ...(canViewRcmModule ? [{
      label: 'RCM',
      path: '/rcm',
      icon: 'CreditCard',
      description: 'Revenue Cycle Management — claims, payments, statements, collections'
    }] : []),
    ...(isSuperAdmin || isAdmin || isRCM || isRegionalManager ? [{
      label: 'Transaction Audit',
      path: '/transaction-audit',
      icon: 'ClipboardSearch',
      description: 'Full audit trail of daily entries, adjustments, and expenses for compliance'
    }] : []),
    {
      label: 'EOD Report',
      path: '/daily-entry-form',
      icon: 'ClipboardList',
      description: 'Submit daily revenue and expense entries'
    },
    ...(hasPermission('huddle:view') ? [{
      label: 'Morning Huddle',
      path: '/daily-morning-huddle',
      icon: 'Sun',
      description: 'Daily morning huddle report and management'
    }] : []),
    {
      label: 'Team Assignments',
      path: '/team-assignments',
      icon: 'ClipboardList',
      description: 'Manage and track team action items'
    },
    {
      label: 'Insurance Verify',
      path: '/insurance-verify',
      icon: 'ShieldCheck',
      description: 'Insurance verification portal'
    },
    ...(hasPermission('reports:financial_view') ? [{
      label: 'Reports',
      path: '/reports',
      icon: 'FileBarChart',
      description: 'Monthly P&L reports and financial exports'
    }] : []),
    ...(isAdmin ? [{
      label: 'Users',
      path: '/users-management',
      icon: 'Users',
      description: 'Manage users, roles, and office assignments'
    }] : []),
    ...(isAdmin ? [{
      label: 'Manage Providers',
      path: '/staff-management',
      icon: 'Stethoscope',
      description: 'Add, edit, and manage providers by office'
    }] : []),
    {
      label: 'Staff Directory',
      path: '/staff-directory',
      icon: 'BookUser',
      description: 'View all active providers organized by office'
    },
    ...(isAdmin && hasPermission('performance:provider_view') ? [{
      label: 'Provider Performance',
      path: '/provider-performance',
      icon: 'Activity',
      description: 'Provider production, collections, and case acceptance'
    }] : []),
    ...(hasPermission('inventory:view') ? [{
      label: 'Inventory Dashboard',
      path: '/inventory-dashboard',
      icon: 'LayoutGrid',
      description: 'Central inventory hub — bone, tissue, and implants across all locations'
    }] : []),
    ...(isRCM ? [{
      label: 'Regional Manager',
      path: '/rcm-dashboard',
      icon: 'ClipboardCheck',
      description: 'Regional Clinical Manager — Supply Request Approvals'
    }] : []),
    ...(isSuperAdmin ? [{
      label: 'Management & Settings',
      path: '/management',
      icon: 'Settings',
      description: 'System configuration for Super Admins'
    }] : []),
  ];

  const isActive = (path) => {
    return location?.pathname === path || location?.pathname?.startsWith(path + '/');
  };

  const handleTabClick = (path) => {
    navigate(path);
  };

  // Update arrow visibility
  const updateArrows = useCallback(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    updateArrows();
    el?.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro?.observe(el);
    return () => {
      el?.removeEventListener('scroll', updateArrows);
      ro?.disconnect();
    };
  }, [updateArrows, tabs?.length]);

  // Scroll active tab into view on mount and route change
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const activeBtn = el?.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [location?.pathname]);

  const scrollBy = (direction) => {
    const el = scrollRef?.current;
    if (!el) return;
    el?.scrollBy({ left: direction * 200, behavior: 'smooth' });
  };

  return (
    <nav className="tab-navigation" role="navigation" aria-label="Main navigation">
      <div className="relative flex items-center h-full">
        {/* Left Arrow */}
        <button
          onClick={() => scrollBy(-1)}
          aria-label="Scroll tabs left"
          className={`
            flex-shrink-0 z-10 flex items-center justify-center w-8 h-full
            bg-gradient-to-r from-[var(--color-card)] via-[var(--color-card)] to-transparent
            text-muted-foreground hover:text-foreground transition-opacity duration-150
            ${canScrollLeft ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          tabIndex={canScrollLeft ? 0 : -1}
        >
          <Icon name="ChevronLeft" size={18} />
        </button>

        {/* Scrollable tab list */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto h-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="tab-list h-full" role="tablist">
            {tabs?.map((tab) => {
              const active = isActive(tab?.path);
              return (
                <button
                  key={tab?.path}
                  data-active={active}
                  onClick={() => handleTabClick(tab?.path)}
                  className={`tab-item ${active ? 'active' : ''}`}
                  role="tab"
                  aria-selected={active}
                  aria-label={tab?.description}
                  title={tab?.description}
                >
                  <div className="flex items-center gap-2 relative">
                    <Icon
                      name={tab?.icon}
                      size={18}
                      color={active ? 'var(--color-primary)' : 'currentColor'}
                    />
                    <span>{tab?.label}</span>
                    {pendingCount > 0 && (tab?.path === '/inventory-dashboard') && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-yellow-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scrollBy(1)}
          aria-label="Scroll tabs right"
          className={`
            flex-shrink-0 z-10 flex items-center justify-center w-8 h-full
            bg-gradient-to-l from-[var(--color-card)] via-[var(--color-card)] to-transparent
            text-muted-foreground hover:text-foreground transition-opacity duration-150
            ${canScrollRight ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          tabIndex={canScrollRight ? 0 : -1}
        >
          <Icon name="ChevronRight" size={18} />
        </button>
      </div>
    </nav>
  );
};

export default TabNavigation;