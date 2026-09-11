/**
 * RBAC Phase 2B — Shared RBAC Helpers
 * Provides: useRbacGuard hook, AccessDenied component, canAccess, canAccessAny, getFirstAllowedTab
 */
import React, { useCallback } from 'react';
import Icon from '../components/AppIcon';
import useRolePermissions from './useRolePermissions';
import { useAuth } from '../contexts/AuthContext';

// ─── AccessDenied Panel ───────────────────────────────────────────────────────
export function AccessDenied({ message, title }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 p-8">
      <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <Icon name="ShieldOff" size={32} className="text-red-600 dark:text-red-400" />
      </div>
      <div className="text-center max-w-sm">
        <h2 className="text-xl font-bold text-foreground mb-2">
          {title || 'Access Restricted'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {message || "You don't have permission to view this page. Contact your administrator to request access."}
        </p>
      </div>
    </div>
  );
}

// ─── useRbacGuard hook ────────────────────────────────────────────────────────
/**
 * Returns { canAccess, canAccessAny, getFirstAllowedTab, loading }
 * Super Admin always passes all checks.
 */
export function useRbacGuard() {
  const { userProfile } = useAuth();
  const { hasPermission, loading } = useRolePermissions();

  const isSuperAdmin = userProfile?.role === 'super_admin';

  /**
   * canAccess(permissionKey) — true if super_admin OR hasPermission(key)
   */
  const canAccess = React.useCallback(
    (permissionKey) => {
      if (isSuperAdmin) return true;
      return hasPermission(permissionKey);
    },
    [isSuperAdmin, hasPermission]
  );

  /**
   * canAccessAny(permissionKeys[]) — true if super_admin OR any key is true
   */
  const canAccessAny = React.useCallback(
    (permissionKeys) => {
      if (isSuperAdmin) return true;
      return permissionKeys?.some((key) => hasPermission(key));
    },
    [isSuperAdmin, hasPermission]
  );

  /**
   * getFirstAllowedTab(tabs, permKeyFn) — returns first tab where permKeyFn(tab) is accessible
   * tabs: array of { id, ... }
   * permKeyFn: (tab) => permissionKey string
   */
  const getFirstAllowedTab = React.useCallback(
    (tabs, permKeyFn) => {
      if (isSuperAdmin) return tabs?.[0]?.id || null;
      const allowed = tabs?.find((tab) => hasPermission(permKeyFn(tab)));
      return allowed?.id || null;
    },
    [isSuperAdmin, hasPermission]
  );

  return { canAccess, canAccessAny, getFirstAllowedTab, loading, isSuperAdmin };
}

export default useRbacGuard;
