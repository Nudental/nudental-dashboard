import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const personalResourcePermissions = new Set([
  'inventory:edit',
  'resources.inventory.bulk_import.view',
  'resources.inventory.settings.view',
  'resources.reports.full_workbook.export',
  'resources.reports.individual_export',
  'reports:financial_view',
  'resources.reports.view',
  'resources.reports.pl_summary.view',
  'resources.reports.office_breakdown.view',
  'resources.reports.goal_leaderboard.view',
  'resources.reports.period_comparison.view',
  'resources.reports.revenue_by_provider.view',
  'purchasing.records.manage',
  'inventory:view',
  'resources.inventory.view',
  'resources.inventory.overview.view',
  'resources.inventory.front_desk.view',
  'resources.inventory.monthly_supply.view',
  'resources.inventory.bone_tissue.view',
  'resources.inventory.implant.view',
  'resources.inventory.reports.view',
  'resources.inventory.usage_log.view',
  'resources.directory.view',
]);

// The sidebar and open page can request the same capability during a single render.
const pendingReviews = new Map();
function canReviewInsurance(userId) {
  if (!pendingReviews.has(userId)) {
    const request = Promise.resolve(supabase.from('insurance_daily_reviewers')
      .select('user_id').eq('user_id', userId).maybeSingle())
      .then(({ data }) => Boolean(data), () => false)
      .finally(() => pendingReviews.delete(userId));
    pendingReviews.set(userId, request);
  }
  return pendingReviews.get(userId);
}

/**
 * Hook to load and check role permissions for the current user.
 * Fetches from role_permissions table based on userProfile.role.
 */
const useRolePermissions = () => {
  const { user, userProfile } = useAuth();
  const hasPersonalResources = user?.app_metadata?.nu_dashboard_resources === true
    && user.id === userProfile?.id
    && userProfile?.is_active === true
    && userProfile?.is_approved === true;
  const [permissionsMap, setPermissionsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const request = useRef(0);

  const loadPermissions = useCallback(async () => {
    const sequence = ++request.current;
    setLoading(true);
    setPermissionsMap({});
    const role = userProfile?.role;
    if (!role) {
      setPermissionsMap({});
      setLoading(false);
      return;
    }
    const dailyReview = await canReviewInsurance(userProfile.id);
    if (sequence !== request.current) return;
    // Super admin and admin always have all permissions — skip DB query entirely
    if (role === 'super_admin') {
      setPermissionsMap({ __all: true, 'insurance.daily.review': dailyReview });
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        ?.from('role_permissions')
        ?.select('permission, enabled')
        ?.eq('role', role);
      if (error) throw error;
      const map = { 'insurance.daily.review': dailyReview };
      data?.forEach((row) => {
        map[row?.permission] = row?.enabled;
      });
      if (role === 'staff') {
        const purchasing = await supabase.from('purchasing_record_admins').select('user_id').eq('user_id', userProfile.id).maybeSingle();
        if (purchasing.data) map['purchasing.records.manage'] = true;
        const grants = await supabase.from('staff_workflow_grants').select('permission').eq('user_id', userProfile.id);
        if (!grants.error) grants.data.forEach(({permission}) => {map[permission] = true;});
      }
      if (role === 'regional_manager' || role === 'staff') {
        const payroll = await supabase.from('named_payroll_permissions').select('permission').eq('user_id', userProfile.id);
        if (!payroll.error) payroll.data.forEach(({permission}) => {map[permission] = true;});
      }
      if (sequence !== request.current) return;
      setPermissionsMap(map);
    } catch (err) {
      console.error('Failed to load role permissions:', err);
      if (sequence === request.current) setPermissionsMap({});
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [userProfile?.id, userProfile?.role]);

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
      if (permissionKey === 'resources.inventory.assigned_scans') return hasPersonalResources;
      if (hasPersonalResources && personalResourcePermissions.has(permissionKey)) return true;
      if (permissionKey === 'insurance.daily.review') return !!permissionsMap[permissionKey];
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
    [permissionsMap, userProfile?.role, hasPersonalResources]
  );

  return { hasPermission, permissionsMap, loading };
};

export default useRolePermissions;
