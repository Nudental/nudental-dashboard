import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';


const STORAGE_KEY = 'nu_dental_quick_actions_prefs';

// All possible quick actions with their permission requirements
const ALL_QUICK_ACTIONS = [
  {
    id: 'morning_huddle',
    label: 'Morning Huddle',
    shortLabel: 'Huddle',
    icon: 'Sun',
    path: '/daily-morning-huddle',
    color: 'bg-amber-500',
    textColor: 'text-amber-600',
    bgLight: 'bg-amber-50',
    borderColor: 'border-amber-200',
    permission: 'huddle:view',
    description: 'Open daily morning huddle',
  },
  {
    id: 'daily_entry',
    label: 'EOD Report',
    shortLabel: 'EOD',
    icon: 'ClipboardList',
    path: '/daily-entry-form',
    color: 'bg-indigo-500',
    textColor: 'text-indigo-600',
    bgLight: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    permission: null, // always visible
    description: 'Submit daily revenue & expense entry',
  },
  {
    id: 'inventory_request',
    label: 'Inventory Request',
    shortLabel: 'Inventory',
    icon: 'Package',
    path: '/inventory-dashboard',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600',
    bgLight: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    permission: 'inventory:view',
    description: 'View inventory & submit requests',
  },
];

// Persist last-used actions to localStorage for offline persistence
const loadPersistedPrefs = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

const savePersistedPrefs = (prefs) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (_) {}
};

const MobileQuickActionMenu = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const { isOnline, pendingCount } = useOfflineStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [recentActions, setRecentActions] = useState([]);

  // Load persisted recent actions on mount
  useEffect(() => {
    const prefs = loadPersistedPrefs();
    if (prefs?.recentActions) {
      setRecentActions(prefs?.recentActions);
    }
  }, []);

  // Filter actions based on role permissions
  const visibleActions = ALL_QUICK_ACTIONS?.filter((action) => {
    if (!action?.permission) return true;
    return hasPermission(action?.permission);
  });

  // Sort: recently used first, then default order
  const sortedActions = [...visibleActions]?.sort((a, b) => {
    const aIdx = recentActions?.indexOf(a?.id);
    const bIdx = recentActions?.indexOf(b?.id);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const handleActionTap = useCallback(
    (action) => {
      // Update recent actions (most recent first, max 3)
      const updated = [action?.id, ...recentActions?.filter((id) => id !== action?.id)]?.slice(0, 3);
      setRecentActions(updated);
      savePersistedPrefs({ recentActions: updated });

      setIsOpen(false);
      navigate(action?.path);
    },
    [navigate, recentActions]
  );

  // Don't render on login/auth pages or if no user
  const hiddenPaths = ['/login', '/forgot-password', '/reset-password'];
  if (hiddenPaths?.includes(location?.pathname) || !userProfile) return null;

  // Don't render while permissions are loading
  if (permLoading) return null;

  // Only show on mobile (md and below) — handled via CSS
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[190] bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      {/* Action Sheet */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 z-[200] md:hidden">
          <div className="flex flex-col gap-3 items-end">
            {/* Offline notice */}
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-50 border border-yellow-200 shadow-md">
                <Icon name="WifiOff" size={14} className="text-yellow-600 flex-shrink-0" />
                <span className="text-xs font-medium text-yellow-700">
                  Offline{pendingCount > 0 ? ` — ${pendingCount} queued` : ''}
                </span>
              </div>
            )}

            {/* Action buttons */}
            {sortedActions?.map((action, idx) => (
              <button
                key={action?.id}
                onClick={() => handleActionTap(action)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border ${
                  action?.bgLight
                } ${action?.borderColor} active:scale-95 transition-all duration-150`}
                style={{
                  animationDelay: `${idx * 50}ms`,
                }}
                aria-label={action?.label}
              >
                {/* Recent badge */}
                {recentActions?.[0] === action?.id && (
                  <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white" />
                )}
                <div
                  className={`w-9 h-9 rounded-xl ${action?.color} flex items-center justify-center shadow-sm flex-shrink-0`}
                >
                  <Icon name={action?.icon} size={18} className="text-white" />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${action?.textColor}`}>{action?.label}</p>
                  <p className="text-xs text-slate-400 leading-tight">{action?.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* FAB Button */}
      <div className="fixed bottom-6 right-4 z-[200] md:hidden">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 active:scale-90 ${
            isOpen
              ? 'bg-slate-700 rotate-45' :'bg-indigo-600 hover:bg-indigo-700'
          }`}
          aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
          aria-expanded={isOpen}
        >
          <Icon
            name={isOpen ? 'X' : 'Zap'}
            size={24}
            className="text-white transition-transform duration-200"
          />
          {/* Pending sync badge */}
          {!isOnline && pendingCount > 0 && !isOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 border-2 border-white flex items-center justify-center">
              <span className="text-[9px] font-bold text-yellow-900">{pendingCount > 9 ? '9+' : pendingCount}</span>
            </span>
          )}
        </button>
      </div>
    </>
  );
};

export default MobileQuickActionMenu;
