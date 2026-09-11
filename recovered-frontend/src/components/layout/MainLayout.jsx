import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import OfflineBanner from '../ui/OfflineBanner';
import MobileQuickActionMenu from '../ui/MobileQuickActionMenu';
import CommandPalette from './CommandPalette';

import { useAuth } from '../../contexts/AuthContext';
import { useOffice } from '../../contexts/OfficeContext';
import { useToast } from '../../contexts/ToastContext';
import { subscribeSupplyNotifications, unsubscribeSupplyNotifications } from '../../services/supplyNotificationService';
import {
  subscribeOrderNotifications,
  unsubscribeOrderNotifications,
  subscribeHuddleNotifications,
  unsubscribeHuddleNotifications,
} from '../../services/pushNotificationService';
import useBirthdayCheck from '../../hooks/useBirthdayCheck';
import BirthdayModal from '../BirthdayModal';
import BirthdayBanner from '../BirthdayBanner';
import { supabase } from '../../lib/supabase';
import AppIcon from '../AppIcon';

const SIDEBAR_EXPANDED_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;

// ─── Profile Gate Loading Screen ─────────────────────────────────────────────
const GateLoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-3">
      <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm text-gray-500">Verifying account access…</p>
    </div>
  </div>
);

// ─── Profile Gate Blocked Screen ─────────────────────────────────────────────
const GateBlockedScreen = ({ message, onSignOut }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md px-8 py-10 text-center">
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
          <AppIcon name="ShieldAlert" size={28} className="text-red-500" />
        </div>
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">Access Denied</h2>
      <p className="text-sm text-gray-600 mb-6">
        {message || 'Your dashboard account is not active. Please contact your administrator.'}
      </p>
      <button
        onClick={onSignOut}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <AppIcon name="LogOut" size={15} />
        Sign Out
      </button>
    </div>
  </div>
);

const MainLayout = () => {
  const { userProfile, user, loading, profileLoading, profileGateStatus, profileGateMessage, signOut } = useAuth();
  const { offices } = useOffice();
  const { info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nu_sidebar_collapsed') === 'true';
    } catch (_) {
      return false;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('nu_sidebar_collapsed', String(next)); } catch (_) {}
      return next;
    });
  };

  // ─── Profile gate enforcement ───────────────────────────────────────────
  useEffect(() => {
    if (profileGateStatus === 'must_change_password') {
      if (location?.pathname !== '/change-password') {
        navigate('/change-password', { replace: true });
      }
    }
  }, [profileGateStatus, location?.pathname, navigate]);

  // ─── OTP gate enforcement ───────────────────────────────────────────────
  useEffect(() => {
    if (profileGateStatus === 'otp_required') {
      if (location?.pathname !== '/otp-challenge') {
        navigate('/otp-challenge', { replace: true });
      }
    }
  }, [profileGateStatus, location?.pathname, navigate]);

  // ─── No session → redirect to login ────────────────────────────────────
  useEffect(() => {
    if (!loading && !user && profileGateStatus !== 'loading') {
      navigate('/login', { replace: true });
    }
  }, [loading, user, profileGateStatus, navigate]);

  // Cmd+K / Ctrl+K to open command palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e?.metaKey || e?.ctrlKey) && e?.key === 'k') {
        e?.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for swipe-right-from-edge event to open mobile drawer
  useEffect(() => {
    const handleOpenDrawer = () => setMobileDrawerOpen(true);
    window.addEventListener('nu-open-drawer', handleOpenDrawer);
    return () => window.removeEventListener('nu-open-drawer', handleOpenDrawer);
  }, []);

  // Real-time toast for new pending approvals
  useEffect(() => {
    const canApprove = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager', 'office_manager']?.includes(userProfile?.role);
    if (!canApprove || !userProfile?.id) return;

    let channel;
    try {
      channel = supabase
        ?.channel(`pending-approvals-toast-${Date.now()}`)
        ?.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'daily_entries', filter: 'status=eq.pending' },
          (payload) => {
            info('New Pending Approval', 'A new daily entry is awaiting your review.', {
              duration: 6000,
              action: { label: 'Review', onClick: () => window.location?.assign('/pending-approvals') },
            });
          }
        )
        ?.subscribe();
    } catch (err) {
      console.warn('[pending-approvals-toast] channel error:', err?.message);
    }

    return () => { try { supabase?.removeChannel(channel); } catch (_) {} };
  }, [userProfile?.id, userProfile?.role, info]);

  // Birthday check — runs once per login session
  const {
    showOwnBirthdayModal,
    staffBirthdays,
    showStaffBanner,
    dismissOwnModal,
    dismissStaffBanner,
  } = useBirthdayCheck({ user, userProfile });

  // Wire up all Realtime push notification subscriptions
  useEffect(() => {
    if (!userProfile?.id) return;

    subscribeSupplyNotifications(userProfile);
    subscribeOrderNotifications(userProfile);
    subscribeHuddleNotifications(userProfile, offices || []);

    return () => {
      unsubscribeSupplyNotifications();
      unsubscribeOrderNotifications();
      unsubscribeHuddleNotifications();
    };
  }, [userProfile?.id, userProfile?.role, offices?.length]);

  const firstName = userProfile?.full_name?.split(' ')?.[0] || userProfile?.full_name || 'there';
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  // ─── Gate: loading (auth or profile/OTP check in progress) ─────────────
  if (loading || profileGateStatus === 'loading') {
    return <GateLoadingScreen />;
  }

  // ─── Gate: blocked profile ──────────────────────────────────────────────
  if (profileGateStatus === 'blocked') {
    return (
      <GateBlockedScreen
        message={profileGateMessage}
        onSignOut={async () => {
          await signOut();
          navigate('/login', { replace: true });
        }}
      />
    );
  }

  // ─── Gate: must_change_password — render change-password route only ─────
  if (profileGateStatus === 'must_change_password') {
    if (location?.pathname !== '/change-password') {
      return <GateLoadingScreen />;
    }
    return (
      <div className="min-h-screen bg-gray-50">
        <OfflineBanner />
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    );
  }

  // ─── Gate: otp_required — render OTP challenge route only ──────────────
  if (profileGateStatus === 'otp_required') {
    if (location?.pathname !== '/otp-challenge') {
      return <GateLoadingScreen />;
    }
    return (
      <div className="min-h-screen bg-gray-50">
        <OfflineBanner />
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    );
  }

  // ─── Gate: ok — normal layout ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      {showStaffBanner && (
        <BirthdayBanner staffNames={staffBirthdays} onDismiss={dismissStaffBanner} />
      )}

      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      <Header
        onMobileMenuToggle={() => setMobileDrawerOpen(prev => !prev)}
        mobileMenuOpen={mobileDrawerOpen}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <Sidebar
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <main
        className="min-h-screen transition-all duration-300 ease-in-out"
        style={{
          marginTop: 'var(--header-height)',
          marginLeft: 0,
        }}
      >
        <div
          className="hidden lg:block"
          style={{ marginLeft: sidebarWidth }}
        >
          <Outlet />
        </div>
        <div className="lg:hidden">
          <Outlet />
        </div>
      </main>

      <MobileQuickActionMenu />

      {showOwnBirthdayModal && (
        <BirthdayModal firstName={firstName} onDismiss={dismissOwnModal} />
      )}
    </div>
  );
};

export default MainLayout;