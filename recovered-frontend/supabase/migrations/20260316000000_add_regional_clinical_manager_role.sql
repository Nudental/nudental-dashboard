-- Migration: Add Regional Clinical Manager role with permissions
-- Scope: Regional (Eatontown, Brick, Barnegat, Staten Island)
-- Primary user: Maia Dolidze (Maia@thenudental.com)
-- Notifications: Back Staff and Clinical Supply routing

DO $$
DECLARE
  all_perms TEXT[] := ARRAY[
    'view_reports',
    'edit_entries',
    'manage_users',
    'approve_entries',
    'manage_categories',
    'view_audit_logs',
    'huddle:view',
    'huddle:edit',
    'analytics:financial_view',
    'reports:financial_view',
    'performance:office_view',
    'performance:provider_view',
    'inventory:view',
    'inventory:edit',
    'request:front_desk_order',
    'request:back_staff_order',
    'dashboard:executive_overview'
  ];
  p TEXT;
BEGIN
  -- Seed all permissions for regional_clinical_manager with appropriate defaults
  FOREACH p IN ARRAY all_perms LOOP
    INSERT INTO public.role_permissions (role, permission, enabled)
    VALUES (
      'regional_clinical_manager',
      p,
      CASE
        -- Granted permissions per spec
        WHEN p IN (
          'inventory:view',
          'inventory:edit',
          'huddle:edit',
          'huddle:view',
          'performance:office_view',
          'dashboard:executive_overview',
          'view_reports',
          'request:back_staff_order'
        ) THEN true
        ELSE false
      END
    )
    ON CONFLICT (role, permission) DO UPDATE SET enabled = EXCLUDED.enabled;
  END LOOP;

  -- Also seed for regional_manager role if not already present
  FOREACH p IN ARRAY all_perms LOOP
    INSERT INTO public.role_permissions (role, permission, enabled)
    VALUES (
      'regional_manager',
      p,
      CASE
        WHEN p IN (
          'view_reports',
          'approve_entries',
          'view_audit_logs',
          'analytics:financial_view',
          'reports:financial_view',
          'performance:office_view',
          'performance:provider_view',
          'huddle:view',
          'inventory:view'
        ) THEN true
        ELSE false
      END
    )
    ON CONFLICT (role, permission) DO NOTHING;
  END LOOP;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'regional_clinical_manager migration error: %', SQLERRM;
END;
$$;
