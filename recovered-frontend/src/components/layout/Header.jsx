import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { notificationsService } from '../../services/notificationsService';
import { supabase } from '../../lib/supabase';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import SupplyNotificationBell from '../ui/SupplyNotificationBell';
import { subscribeSupplyNotifications, unsubscribeSupplyNotifications } from '../../services/supplyNotificationService';
import { useOffice } from '../../contexts/OfficeContext';
import { useTheme, THEMES, THEME_NAMES } from '../../contexts/ThemeContext';
import { useHelp } from '../../contexts/HelpContext';
import { profilePhotosService } from '../../services/managementService';
import { staffDirectoryService } from '../../services/staffDirectoryService';
import { usePendingApprovalsCount } from './Sidebar';
import { ascendApi } from '../../services/ascendApi';


const ROLE_LABELS = {
  staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Administrator',
  office_manager: 'Office Manager',
  doctor: 'Doctor',
};

// Returns greeting text + icon name based on current hour
const getGreetingInfo = () => {
  const hour = new Date()?.getHours();
  if (hour >= 5 && hour < 12) return { text: 'Good Morning', icon: 'Sun' };
  if (hour >= 12 && hour < 17) return { text: 'Good Afternoon', icon: 'Cloud' };
  return { text: 'Good Evening', icon: 'Moon' };
};

// Notification type grouping config
const NOTIF_TYPE_CONFIG = {
  pending_approval: { label: 'Pending Approvals', icon: 'Clock', color: 'text-yellow-600' },
  birthday: { label: 'Birthdays', icon: 'Cake', color: 'text-pink-500' },
  profile_update: { label: 'Profile Updates', icon: 'User', color: 'text-blue-500' },
  supply_request: { label: 'Supply Requests', icon: 'Package', color: 'text-purple-500' },
  task: { label: 'Tasks', icon: 'CheckSquare', color: 'text-emerald-500' },
  system: { label: 'System', icon: 'Bell', color: 'text-muted-foreground' },
};

const getNotifGroup = (type) => NOTIF_TYPE_CONFIG?.[type] || NOTIF_TYPE_CONFIG?.system;

const Header = ({ onMobileMenuToggle, mobileMenuOpen, onOpenCommandPalette }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, signOut, user } = useAuth();
  const { officeDisplayName, selectedOffice, canSwitchOffice, offices, switchOffice } = useOffice();
  const { currentTheme, selectTheme } = useTheme();
  const { setHelpOpen } = useHelp();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveConnected, setLiveConnected] = useState(false);
  const { isOnline, pendingCount } = useOfflineStatus();
  const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);
  const [greetingInfo, setGreetingInfo] = useState(getGreetingInfo());
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  // Ascend API live status
  const [ascendStatus, setAscendStatus] = useState(null); // null=checking, true=live, false=offline

  // Notification bell dropdown state
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef(null);

  // Pending approvals count for header badge
  const pendingApprovalsCount = usePendingApprovalsCount(userProfile);

  // Update greeting every minute
  useEffect(() => {
    const interval = setInterval(() => setGreetingInfo(getGreetingInfo()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Live connection heartbeat check
  useEffect(() => {
    if (!user?.id) return;
    let channel;
    try {
      channel = supabase?.channel(`header-live-check-${Date.now()}`)?.subscribe((status) => {
        setLiveConnected(status === 'SUBSCRIBED');
      });
    } catch (err) {
      console.warn('[header-live-check] channel error:', err?.message);
    }
    return () => {
      try { supabase?.removeChannel(channel); } catch (_) {}
      setLiveConnected(false);
    };
  }, [user?.id]);

  // Ascend API health check on mount
  useEffect(() => {
    let cancelled = false;
    const checkAscend = async () => {
      try {
        await ascendApi?.health();
        if (!cancelled) setAscendStatus(true);
      } catch {
        if (!cancelled) setAscendStatus(false);
      }
    };
    checkAscend();
    return () => { cancelled = true; };
  }, []);

  // Load unread notification count
  useEffect(() => {
    if (!user?.id) return;
    const loadCount = async () => {
      const count = await notificationsService?.getUnreadCount();
      setUnreadCount(count);
    };
    loadCount();
    window.addEventListener('notifications:changed', loadCount);

    // Recount saved changes, including read/archive updates.
    let channel = null;
    try {
      channel = notificationsService?.subscribeToNotifications(user?.id, loadCount);
    } catch (err) {
      console.error('Failed to subscribe to notifications:', err);
    }
    return () => {
      window.removeEventListener('notifications:changed', loadCount);
      if (channel) {
        try {
          notificationsService?.unsubscribe(channel);
        } catch (err) {
          console.error('Failed to unsubscribe from notifications:', err);
        }
      }
    };
  }, [user?.id]);

  // Subscribe to supply request status notifications
  useEffect(() => {
    if (!userProfile?.id) return;
    subscribeSupplyNotifications(userProfile);
    return () => unsubscribeSupplyNotifications();
  }, [userProfile?.id, userProfile?.role, userProfile?.office_id]);

  // Load notifications for bell dropdown
  const loadNotifications = async () => {
    if (!user?.id) return;
    setNotifLoading(true);
    try {
      const data = await notificationsService?.getNotifications({ limit: 30, unreadOnly: false });
      setNotifications(data || []);
    } catch (_) {
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleBellClick = async () => {
    const next = !notifDropdownOpen;
    setNotifDropdownOpen(next);
    if (next) await loadNotifications();
  };

  const handleMarkAllRead = async () => {
    await notificationsService?.markAllAsRead();
    setUnreadCount(0);
    setNotifications(prev => prev?.map(n => ({ ...n, is_read: true })));
  };

  // Group notifications by type
  const groupedNotifications = notifications?.reduce((acc, notif) => {
    const type = notif?.notification_type || 'system';
    if (!acc?.[type]) acc[type] = [];
    acc?.[type]?.push(notif);
    return acc;
  }, {});

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleUserMenu = () => setUserMenuOpen(!userMenuOpen);

  const displayName = userProfile?.full_name || 'User';
  const displayRole = ROLE_LABELS?.[userProfile?.role] || userProfile?.role || 'Staff';
  const displayEmail = userProfile?.email || user?.email || '';
  const initials = displayName?.split(' ')?.map(n => n?.[0])?.join('')?.substring(0, 2) || 'U';
  const firstName = userProfile?.full_name?.split(' ')?.[0] || 'there';

  // Profile photo URL (signed or public) — Directory-first, user_profiles fallback
  const [avatarPhotoUrl, setAvatarPhotoUrl] = useState(null);
  const [avatarImgError, setAvatarImgError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolveAvatar = async () => {
      setAvatarImgError(false);

      // Step 1: Try Directory photo_storage_path
      const email = userProfile?.email || user?.email;
      if (email) {
        try {
          const { data: dirRecord } = await supabase
            ?.from('staff_directory')
            ?.select('photo_storage_path')
            ?.or(`preferred_email.eq.${email},work_email.eq.${email},personal_email.eq.${email}`)
            ?.eq('is_active', true)
            ?.limit(1)
            ?.maybeSingle();

          if (dirRecord?.photo_storage_path) {
            const url = await staffDirectoryService?.getPhotoSignedUrl(dirRecord?.photo_storage_path);
            if (!cancelled && url) {
              setAvatarPhotoUrl(url);
              return;
            }
          }
        } catch {
          // fall through to user_profiles fallback
        }
      }

      // Step 2: Fallback to user_profiles.profile_photo_url
      const rawUrl = userProfile?.profile_photo_url;
      if (!rawUrl) {
        if (!cancelled) setAvatarPhotoUrl(null);
        return;
      }
      if (rawUrl?.startsWith('http')) {
        if (!cancelled) setAvatarPhotoUrl(rawUrl);
        return;
      }
      try {
        const url = await profilePhotosService?.getSignedUrl(rawUrl);
        if (!cancelled) setAvatarPhotoUrl(url || null);
      } catch {
        if (!cancelled) setAvatarPhotoUrl(null);
      }
    };

    resolveAvatar();
    return () => { cancelled = true; };
  }, [userProfile?.profile_photo_url, userProfile?.email, user?.email]);

  const showAvatarPhoto = avatarPhotoUrl && !avatarImgError;

  // Office subtext
  const officeSubtext = "Making smiles and beauty for life!";

  return (
    <header className="header-container">
      <div className="header-content">
        {/* Mobile hamburger menu toggle */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 mr-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 flex-shrink-0"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
        >
          <Icon name={mobileMenuOpen ? 'X' : 'Menu'} size={22} />
        </button>

        <div className="header-logo">
          <img
            src="/assets/images/nu-dental-stacked-logo_1_-1772244427227.png"
            alt="NU Dental logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Dynamic Greeting Section */}
        {userProfile && (
          <div className="hidden lg:flex flex-col justify-center ml-4 pl-4 border-l border-border">
            <div className="flex items-center gap-2">
              <Icon
                name={greetingInfo?.icon}
                size={18}
                className="text-indigo-400 flex-shrink-0"
              />
              <span className="text-slate-500 text-sm font-medium">{greetingInfo?.text},</span>
              <span className="text-slate-800 font-bold" style={{ fontSize: '18px' }}>{firstName}!</span>
              <Icon name="Sparkles" size={14} className="text-indigo-300 flex-shrink-0" />
            </div>

            {/* Office Badge */}
            {canSwitchOffice ? (
              <div className="relative mt-0.5">
                <button
                  onClick={() => setOfficeDropdownOpen(prev => !prev)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  <span className="text-xs">📍</span>
                  <span className="text-xs font-semibold text-indigo-700">
                    Regional View: {selectedOffice ? selectedOffice?.name : 'Select Office'}
                  </span>
                  <Icon name="ChevronDown" size={12} className="text-indigo-500" />
                </button>
                {officeDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[180]"
                      onClick={() => setOfficeDropdownOpen(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute left-0 top-full mt-1 w-52 bg-popover border border-border rounded-lg shadow-elevation-3 z-[190] py-1">
                      {offices?.map(office => (
                        <button
                          key={office?.id}
                          onClick={() => {
                            switchOffice(office?.id);
                            setOfficeDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left ${
                            selectedOffice?.id === office?.id ? 'text-indigo-700 font-semibold bg-indigo-50' : 'text-foreground'
                          }`}
                        >
                          <span className="text-xs">📍</span>
                          {office?.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : selectedOffice ? (
              <div className="flex items-center gap-1.5 mt-0.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 w-fit">
                <span className="text-xs">📍</span>
                <span className="text-xs font-semibold text-indigo-700">
                  Currently Viewing: {selectedOffice?.name}
                </span>
              </div>
            ) : null}

            {/* Subtext */}
            <p className="text-xs text-slate-400 mt-0.5 italic">{officeSubtext}</p>
          </div>
        )}

        <div className="header-actions">
          {/* Office Context Badge — mobile/tablet visibility */}
          {selectedOffice && (
            <div className="flex lg:hidden items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-primary whitespace-nowrap">
                Viewing: {selectedOffice?.name}
              </span>
              {canSwitchOffice && (
                <span className="text-[10px] text-primary/60 ml-0.5">(Global)</span>
              )}
            </div>
          )}

          {/* Cmd+K search button */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border hover:bg-muted/80 text-muted-foreground text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label="Open command palette (Cmd+K)"
              title="Search (⌘K)"
            >
              <Icon name="Search" size={14} />
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden md:flex items-center gap-0.5 px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-medium">
                ⌘K
              </kbd>
            </button>
          )}

          {/* Pending Approvals badge in header */}
          {pendingApprovalsCount > 0 ? (
            <button
              onClick={() => navigate('/pending-approvals')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-300 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50"
              aria-label={`${pendingApprovalsCount} pending approvals`}
              title="Pending Approvals"
            >
              <Icon name="Clock" size={14} className="text-red-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-red-700 whitespace-nowrap">Approvals</span>
              <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount}
              </span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/pending-approvals')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              aria-label="No pending approvals"
              title="Pending Approvals — All Clear"
            >
              <Icon name="CheckCircle" size={14} className="text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap hidden md:inline">All Clear</span>
            </button>
          )}

          {/* Offline / Online indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              isOnline
                ? 'bg-success/10 border-success/20' :'bg-yellow-100 border-yellow-300'
            }`}
            title={isOnline ? 'Online' : `Offline${pendingCount > 0 ? ` — ${pendingCount} pending` : ''}`}
          >
            <Icon
              name={isOnline ? 'Wifi' : 'WifiOff'}
              size={14}
              className={isOnline ? 'text-success' : 'text-yellow-600'}
            />
            <span className={`text-xs font-medium ${isOnline ? 'text-success' : 'text-yellow-700'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {!isOnline && pendingCount > 0 && (
              <span className="bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </div>

          {/* Ascend API live status indicator */}
          {ascendStatus !== null && (
            <div
              className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full border ${
                ascendStatus
                  ? 'bg-emerald-50 border-emerald-200' :'bg-slate-100 border-slate-200'
              }`}
              title={ascendStatus ? 'Dentrix Ascend API: Live' : 'Dentrix Ascend API: Offline'}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  ascendStatus ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span
                className={`text-[11px] font-medium ${
                  ascendStatus ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {ascendStatus ? 'Live' : 'Offline'}
              </span>
            </div>
          )}

          {/* Live indicator */}
          {liveConnected && isOnline && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium text-success">Live</span>
            </div>
          )}

          {/* Bell / Alert Center */}
          <button
            onClick={() => navigate('/alert-center')}
            className={`relative p-2 rounded-lg hover:bg-muted transition-smooth focus:outline-none focus:ring-2 focus:ring-primary ${
              location?.pathname === '/alert-center' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            }`}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <Icon name="Bell" size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Supply Notification Bell */}
          <SupplyNotificationBell />

          {/* Theme Picker */}
          <div className="relative">
            <button
              onClick={() => setThemePickerOpen(prev => !prev)}
              className={`relative p-2 rounded-lg hover:bg-muted transition-smooth focus:outline-none focus:ring-2 focus:ring-primary ${
                themePickerOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
              }`}
              aria-label="Change theme"
              title="Change color theme"
            >
              <Icon name="Palette" size={20} />
            </button>
            {themePickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-[190]"
                  onClick={() => setThemePickerOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-lg shadow-elevation-3 z-[200] p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">Color Theme</p>
                  <div className="space-y-1.5">
                    {THEME_NAMES?.map(themeName => {
                      const vars = THEMES?.[themeName];
                      const isActive = currentTheme === themeName;
                      return (
                        <button
                          key={themeName}
                          onClick={() => { selectTheme(themeName); setThemePickerOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-smooth text-left ${
                            isActive ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
                          }`}
                        >
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: vars?.['--color-primary'] }} />
                            <span className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: vars?.['--color-accent'] }} />
                            <span className="w-4 h-4 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: vars?.['--color-background'] }} />
                          </div>
                          <span className={`text-sm font-medium flex-1 ${isActive ? 'text-primary' : 'text-foreground'}`}>{themeName}</span>
                          {isActive && <Icon name="Check" size={14} className="text-primary flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            iconName="HelpCircle"
            iconSize={20}
            aria-label="Help"
            onClick={() => setHelpOpen(true)}
          />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={toggleUserMenu}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-smooth focus-ring"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm overflow-hidden flex-shrink-0">
                {showAvatarPhoto ? (
                  <img
                    src={avatarPhotoUrl}
                    alt={`${displayName} avatar`}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarImgError(true)}
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-foreground">{displayName}</div>
                <div className="text-xs text-muted-foreground">{displayRole}</div>
              </div>
              <Icon
                name={userMenuOpen ? 'ChevronUp' : 'ChevronDown'}
                size={16}
                color="var(--color-muted-foreground)"
              />
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[190]"
                  onClick={() => setUserMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-popover border border-border rounded-lg shadow-elevation-3 z-[200]">
                  <div className="p-4 border-b border-border">
                    <div className="font-medium text-sm text-popover-foreground">{displayName}</div>
                    <div className="text-xs text-muted-foreground mt-1">{displayEmail}</div>
                    <div className="text-xs text-muted-foreground mt-1">{displayRole}</div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/alert-center');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-muted rounded-md transition-smooth"
                    >
                      <Icon name="Bell" size={16} />
                      <span>Alert Center</span>
                      {unreadCount > 0 && (
                        <span className="ml-auto text-xs bg-destructive text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/profile');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-muted rounded-md transition-smooth"
                    >
                      <Icon name="User" size={16} />
                      <span>Profile Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-popover-foreground hover:bg-muted rounded-md transition-smooth"
                    >
                      <Icon name="Settings" size={16} />
                      <span>Account Settings</span>
                    </button>
                  </div>
                  <div className="p-2 border-t border-border">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-destructive hover:bg-muted rounded-md transition-smooth"
                    >
                      <Icon name="LogOut" size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
