import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to load and check role permissions for the current user.
 * Fetches from role_permissions table based on userProfile.role.
 */
const useRolePermissions = () => {
  const { userProfile } = useAuth();
  const [permissionsMap, setPermissionsMap] = useState({});
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    const role = userProfile?.role;
    if (!role) {
      setPermissionsMap({});
      setLoading(false);
      return;
    }
    // Super admin and admin always have all permissions — skip DB query entirely
    if (role === 'super_admin') {
      setPermissionsMap({ __all: true });
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        ?.from('role_permissions')
        ?.select('permission, enabled')
        ?.eq('role', role);
      if (error) throw error;
      const map = {};
      data?.forEach((row) => {
        map[row?.permission] = row?.enabled;
      });
      setPermissionsMap(map);
    } catch (err) {
      console.error('Failed to load role permissions:', err);
      setPermissionsMap({});
    } finally {
      setLoading(false);
    }
  }, [userProfile?.role]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  /**
   * Check if the current user has a specific permission.
   * Super admin always returns true.
   * Admin role gets supply chain + core module permissions by default.
   * dashboard:executive_overview is NEVER granted by default — DB value only.
   */
  const hasPermission = useCallback(
    (permissionKey) => {
      if (permissionsMap?.__all) return true;

      // dashboard:executive_overview is strictly DB-controlled — no fallback for any role
      if (permissionKey === 'dashboard:executive_overview') {
        return !!permissionsMap?.[permissionKey];
      }

      // Admin role defaults for supply chain permissions
      if (userProfile?.role === 'admin') {
        if (
          permissionKey === 'request:front_desk_order' ||
          permissionKey === 'request:back_staff_order' ||
          permissionKey === 'huddle:view' ||
          permissionKey === 'huddle:edit' ||
          permissionKey === 'analytics:financial_view' ||
          permissionKey === 'reports:financial_view' ||
          permissionKey === 'performance:office_view' ||
          permissionKey === 'inventory:view' ||
          permissionKey === 'inventory:edit'
        ) {
          // Check DB first; fall back to true for admin if not yet seeded
          return permissionsMap?.[permissionKey] !== false;
        }
      }

      // Regional Manager / Regional Clinical Manager defaults
      // These match the DB grants in migrations 20260316 and 20260319.
      // Fallback prevents redirect if DB rows are missing for a user.
      if (
        userProfile?.role === 'regional_manager' ||
        userProfile?.role === 'regional_clinical_manager'
      ) {
        const regionalDefaults = [
          'analytics:financial_view',
          'reports:financial_view',
          'performance:office_view',
          'performance:provider_view',
          'huddle:view',
          'huddle:edit',
          'view_reports',
          'approve_entries',
          'view_audit_logs',
        ];
        if (regionalDefaults?.includes(permissionKey)) {
          return permissionsMap?.[permissionKey] !== false;
        }
      }

      return !!permissionsMap?.[permissionKey];
    },
    [permissionsMap, userProfile?.role]
  );

  return { hasPermission, permissionsMap, loading };
};

export default useRolePermissions;
