import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { NAV_GROUPS, getVisibleGroup } from '../../config/navConfig';
import { supabase } from '../../lib/supabase';

// Sidebar width constants
const SIDEBAR_EXPANDED_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;

/**
 * Pending approvals count hook — reads from daily_entries where status = 'pending'
 */
export function usePendingApprovalsCount(userProfile) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userProfile?.id) return;
    const role = userProfile?.role;
    const canApprove = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager', 'office_manager']?.includes(role);
    if (!canApprove) return;

    const fetchCount = async () => {
      try {
        const { count: c } = await supabase
          ?.from('daily_entries')
          ?.select('id', { count: 'exact', head: true })
          ?.eq('status', 'pending');
        setCount(c || 0);
      } catch (_) {
        setCount(0);
      }
    };

    fetchCount();

    let channel;
    try {
      channel = supabase
        ?.channel(`pending-approvals-count-${Date.now()}`)
        ?.on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' }, fetchCount)
        ?.subscribe();
    } catch (err) {
      console.warn('[pending-approvals-count] channel error:', err?.message);
    }

    return () => {
      try { if (channel && typeof channel === 'object') supabase?.removeChannel(channel); } catch (_) {}
    };
  }, [userProfile?.id, userProfile?.role]);

  return count;
}

/**
 * Tooltip wrapper for collapsed sidebar items
 */
const Tooltip = ({ label, children, show }) => {
  if (!show) return children;
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="
        pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[200]
        px-2.5 py-1.5 bg-popover border border-border rounded-lg shadow-lg
        text-xs font-medium text-foreground whitespace-nowrap
        opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150
      ">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
      </div>
    </div>
  );
};

/**
 * Single nav item (leaf)
 */
const NavItem = ({ item, isActive, isCollapsed, pendingCount, onClick, isFavorite, onToggleFavorite }) => {
  const badge = item?.badge === 'pendingApprovals' ? pendingCount : 0;
  const hasBadge = badge > 0;

  const button = (
    <button
      onClick={() => onClick(item?.route)}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-primary/50
        ${isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }
        ${isCollapsed ? 'justify-center px-2' : ''}
      `}
      aria-label={item?.description || item?.label}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="relative flex-shrink-0">
        <Icon
          name={item?.icon}
          size={18}
          className={isActive ? 'text-primary-foreground' : 'text-current'}
        />
        {hasBadge && isCollapsed && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none bg-red-500">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <>
          <span className="flex-1 text-sm font-medium truncate">
            {item?.shortLabel || item?.label}
          </span>
          {hasBadge && (
            <span className="min-w-[20px] h-5 px-1.5 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none flex-shrink-0 bg-red-500">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
          {/* Star favorite button */}
          <button
            onClick={e => { e?.stopPropagation(); onToggleFavorite?.(item); }}
            className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all flex-shrink-0 ${
              isFavorite ? 'opacity-100 text-yellow-500' : 'text-muted-foreground hover:text-yellow-400'
            }`}
            aria-label={isFavorite ? `Unpin ${item?.label}` : `Pin ${item?.label} to favorites`}
            title={isFavorite ? 'Remove from favorites' : 'Pin to favorites'}
          >
            <Icon name={isFavorite ? 'Star' : 'Star'} size={13} className={isFavorite ? 'fill-yellow-400 text-yellow-400' : ''} />
          </button>
        </>
      )}
    </button>
  );

  return (
    <div className="group relative">
      <Tooltip label={item?.shortLabel || item?.label} show={isCollapsed}>
        {button}
      </Tooltip>
    </div>
  );
};

/**
 * Nav group (collapsible section) with persistent scroll
 */
const NavGroup = ({ group, isCollapsed, currentPath, pendingCount, onNavigate, defaultOpen, favorites, onToggleFavorite }) => {
  const hasActiveChild = group?.children?.some(child =>
    currentPath === child?.route || currentPath?.startsWith(child?.route + '/')
  );

  const storageKey = `nu_group_open_${group?.id}`;
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return stored === 'true';
    } catch (_) {}
    return defaultOpen || hasActiveChild;
  });

  useEffect(() => {
    if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  const handleToggle = () => {
    setIsOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(storageKey, String(next)); } catch (_) {}
      return next;
    });
  };

  const groupBadge = group?.badge === 'pendingApprovals' ? pendingCount : 0;

  if (isCollapsed) {
    return (
      <div className="space-y-0.5">
        {group?.children?.map(child => {
          const isActive = currentPath === child?.route || currentPath?.startsWith(child?.route + '/');
          return (
            <NavItem
              key={child?.id}
              item={child}
              isActive={isActive}
              isCollapsed={true}
              pendingCount={pendingCount}
              onClick={onNavigate}
              isFavorite={favorites?.includes(child?.id)}
              onToggleFavorite={onToggleFavorite}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        onClick={handleToggle}
        className={`
          w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left
          transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50
          ${hasActiveChild
            ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }
        `}
        aria-expanded={isOpen}
        aria-label={`${group?.label} navigation group`}
      >
        <Icon name={group?.icon} size={16} className="flex-shrink-0" />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider">
          {group?.label}
        </span>
        {groupBadge > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none flex-shrink-0">
            {groupBadge > 99 ? '99+' : groupBadge}
          </span>
        )}
        <Icon
          name={isOpen ? 'ChevronDown' : 'ChevronRight'}
          size={14}
          className="flex-shrink-0 transition-transform duration-200"
        />
      </button>
      {isOpen && (
        <div className="pl-2 space-y-0.5">
          {group?.children?.map(child => {
            const isActive = currentPath === child?.route || currentPath?.startsWith(child?.route + '/');
            return (
              <NavItem
                key={child?.id}
                item={child}
                isActive={isActive}
                isCollapsed={false}
                pendingCount={pendingCount}
                onClick={onNavigate}
                isFavorite={favorites?.includes(child?.id)}
                onToggleFavorite={onToggleFavorite}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Main Sidebar component
 */
const Sidebar = ({ isOpen, onClose, isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useAuth();
  const { hasPermission } = useRolePermissions();
  const pendingCount = usePendingApprovalsCount(userProfile);
  const sidebarRef = useRef(null);

  // Pinned favorites — stored in localStorage
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('nu_sidebar_favorites') || '[]');
    } catch (_) { return []; }
  });

  const handleToggleFavorite = useCallback((item) => {
    setFavorites(prev => {
      const next = prev?.includes(item?.id)
        ? prev?.filter(id => id !== item?.id)
        : [...prev, item?.id];
      try { localStorage.setItem('nu_sidebar_favorites', JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }, []);

  // Build visible groups
  const visibleGroups = NAV_GROUPS?.map(group => getVisibleGroup(group, userProfile, hasPermission))?.filter(Boolean);

  // Build favorites list from all nav items
  const allNavItems = visibleGroups?.flatMap(g => g?.children || []);
  const pinnedItems = allNavItems?.filter(item => favorites?.includes(item?.id));

  const handleNavigate = useCallback((route) => {
    navigate(route);
    if (onClose) onClose();
  }, [navigate, onClose]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e?.key === 'Escape' && isOpen) onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && sidebarRef?.current) {
      sidebarRef?.current?.focus();
    }
  }, [isOpen]);

  // Swipe gesture for mobile drawer
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e?.touches?.[0]?.clientX;
    touchStartY.current = e?.touches?.[0]?.clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX?.current === null) return;
    const dx = e?.changedTouches?.[0]?.clientX - touchStartX?.current;
    const dy = Math.abs(e?.changedTouches?.[0]?.clientY - (touchStartY?.current || 0));
    // Only horizontal swipes (dx > 60, dy < 80)
    if (Math.abs(dx) > 60 && dy < 80) {
      if (dx < 0 && isOpen) onClose?.(); // swipe left = close
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, [isOpen, onClose]);

  // Global swipe-right to open drawer (from left edge)
  useEffect(() => {
    const handleGlobalTouchStart = (e) => {
      if (e?.touches?.[0]?.clientX < 20) {
        touchStartX.current = e?.touches?.[0]?.clientX;
        touchStartY.current = e?.touches?.[0]?.clientY;
      }
    };
    const handleGlobalTouchEnd = (e) => {
      if (touchStartX?.current === null) return;
      const dx = e?.changedTouches?.[0]?.clientX - touchStartX?.current;
      const dy = Math.abs(e?.changedTouches?.[0]?.clientY - (touchStartY?.current || 0));
      if (dx > 60 && dy < 80 && !isOpen) {
        // swipe right from edge = open
        // We need to call the parent's open handler — emit custom event
        window.dispatchEvent(new CustomEvent('nu-open-drawer'));
      }
      touchStartX.current = null;
      touchStartY.current = null;
    };
    document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleGlobalTouchStart);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isOpen]);

  const sidebarContent = (
    <div
      ref={sidebarRef}
      className={`
        flex flex-col h-full bg-card border-r border-border
        transition-all duration-300 ease-in-out overflow-hidden
        ${isCollapsed ? 'w-16' : 'w-60'}
      `}
      tabIndex={-1}
      aria-label="Main navigation sidebar"
      role="navigation"
    >
      {/* Sidebar header — collapse toggle */}
      <div className={`
        flex items-center border-b border-border flex-shrink-0
        ${isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3'}
      `}>
        {!isCollapsed && (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Navigation
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={isCollapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size={18} />
        </button>
      </div>

      {/* Pinned Favorites section */}
      {!isCollapsed && pinnedItems?.length > 0 && (
        <div className="px-2 pt-3 pb-1 border-b border-border/50">
          <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-600 flex items-center gap-1.5">
            <Icon name="Star" size={11} className="fill-yellow-400 text-yellow-400" />
            Favorites
          </p>
          <div className="space-y-0.5">
            {pinnedItems?.map(item => {
              const isActive = location?.pathname === item?.route || location?.pathname?.startsWith(item?.route + '/');
              return (
                <NavItem
                  key={`fav-${item?.id}`}
                  item={item}
                  isActive={isActive}
                  isCollapsed={false}
                  pendingCount={pendingCount}
                  onClick={handleNavigate}
                  isFavorite={true}
                  onToggleFavorite={handleToggleFavorite}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Approvals quick badge — only when expanded */}
      {!isCollapsed && pendingCount > 0 && (
        <button
          onClick={() => handleNavigate('/pending-approvals')}
          className="mx-3 mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50"
          aria-label={`${pendingCount} pending approvals`}
        >
          <div className="relative flex-shrink-0">
            <Icon name="Clock" size={16} className="text-red-600" />
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full animate-pulse" />
          </div>
          <span className="flex-1 text-xs font-semibold text-red-700">Pending Approvals</span>
          <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        </button>
      )}

      {/* Nav groups */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-1"
        aria-label="Sidebar navigation"
      >
        {visibleGroups?.map((group, idx) => (
          <NavGroup
            key={group?.id}
            group={group}
            isCollapsed={isCollapsed}
            currentPath={location?.pathname}
            pendingCount={pendingCount}
            onNavigate={handleNavigate}
            defaultOpen={idx === 0}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        ))}
      </nav>

      {/* Bottom: collapsed pending indicator */}
      {isCollapsed && pendingCount > 0 && (
        <div className="flex-shrink-0 px-2 pb-3">
          <Tooltip label={`${pendingCount} Pending Approvals`} show={true}>
            <button
              onClick={() => handleNavigate('/pending-approvals')}
              className="w-full flex items-center justify-center p-2 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
              aria-label={`${pendingCount} pending approvals`}
            >
              <div className="relative">
                <Icon name="Clock" size={18} className="text-red-600" />
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              </div>
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — fixed */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 z-[80] overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          top: 'var(--header-height)',
          bottom: 0,
          width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
        }}
        aria-label="Desktop navigation sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Mobile/tablet drawer */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            className="lg:hidden fixed left-0 top-0 bottom-0 z-[120] w-72 flex flex-col shadow-elevation-5"
            aria-label="Mobile navigation drawer"
            role="dialog"
            aria-modal="true"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Mobile drawer header */}
            <div
              className="flex items-center justify-between px-4 py-3 bg-card border-b border-border flex-shrink-0"
              style={{ height: 'var(--header-height)' }}
            >
              <img
                src="/assets/images/nu-dental-stacked-logo_1_-1772244427227.png"
                alt="NU Dental logo"
                className="h-8 w-auto object-contain"
              />
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                aria-label="Close navigation drawer"
              >
                <Icon name="X" size={20} />
              </button>
            </div>

            {/* Mobile nav content */}
            <div className="flex-1 overflow-y-auto bg-card">
              {/* Pinned favorites on mobile */}
              {pinnedItems?.length > 0 && (
                <div className="px-2 pt-3 pb-1 border-b border-border/50">
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-yellow-600 flex items-center gap-1.5">
                    <Icon name="Star" size={11} className="fill-yellow-400 text-yellow-400" />
                    Favorites
                  </p>
                  <div className="space-y-0.5">
                    {pinnedItems?.map(item => {
                      const isActive = location?.pathname === item?.route;
                      return (
                        <NavItem
                          key={`mob-fav-${item?.id}`}
                          item={item}
                          isActive={isActive}
                          isCollapsed={false}
                          pendingCount={pendingCount}
                          onClick={handleNavigate}
                          isFavorite={true}
                          onToggleFavorite={handleToggleFavorite}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {pendingCount > 0 && (
                <button
                  onClick={() => handleNavigate('/pending-approvals')}
                  className="mx-3 mt-3 w-[calc(100%-24px)] flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                  aria-label={`${pendingCount} pending approvals`}
                >
                  <Icon name="Clock" size={16} className="text-red-600 flex-shrink-0" />
                  <span className="flex-1 text-xs font-semibold text-red-700">Pending Approvals</span>
                  <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </span>
                </button>
              )}
              <nav className="py-3 px-2 space-y-1" aria-label="Mobile navigation">
                {visibleGroups?.map((group, idx) => (
                  <NavGroup
                    key={group?.id}
                    group={group}
                    isCollapsed={false}
                    currentPath={location?.pathname}
                    pendingCount={pendingCount}
                    onNavigate={handleNavigate}
                    defaultOpen={idx === 0}
                    favorites={favorites}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </nav>
            </div>
          </aside>
        </>
      )}
    </>
  );
};


export default Sidebar;
