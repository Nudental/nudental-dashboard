-- Migration: Add dashboard:executive_overview permission
-- This permission is Super Admin only and grants access to the Executive Overview screen

DO $$
DECLARE
  roles TEXT[] := ARRAY['admin','front_desk','staff','doctor','hygienist','office_manager','treatment_coordinator','rda','clinical_manager','dental_assistant'];
  r TEXT;
BEGIN
  -- Enable for super_admin
  INSERT INTO role_permissions (role, permission, enabled)
  VALUES ('super_admin', 'dashboard:executive_overview', true)
  ON CONFLICT (role, permission) DO UPDATE SET enabled = true;

  -- Disable for all other roles
  FOREACH r IN ARRAY roles LOOP
    INSERT INTO role_permissions (role, permission, enabled)
    VALUES (r, 'dashboard:executive_overview', false)
    ON CONFLICT (role, permission) DO UPDATE SET enabled = false;
  END LOOP;
END;
$$;
