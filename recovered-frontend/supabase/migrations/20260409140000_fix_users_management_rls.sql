-- Migration: Fix Users Management RLS policies
-- Root cause: admin users blocked from updating other users' profiles
-- Also fixes: admin users blocked from reading all user_office_assignments
-- Timestamp: 20260409140000

-- ─── 1. Fix user_profiles UPDATE policy ──────────────────────────────────
-- Allow admin and super_admin to update any user profile
-- Previously only allowed id = auth.uid() OR is_super_admin()
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.is_super_admin()
  OR (public.is_active_user() AND public.is_admin_or_above())
)
WITH CHECK (
  id = auth.uid()
  OR public.is_super_admin()
  OR (public.is_active_user() AND public.is_admin_or_above())
);

-- ─── 2. Ensure admin can INSERT new user profiles (for invite flow) ───────
DROP POLICY IF EXISTS "admin_insert_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_insert_user_profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  OR public.is_super_admin()
  OR (public.is_active_user() AND public.is_admin_or_above())
);

-- ─── 3. Ensure user_office_assignments SELECT allows admin to read all ────
-- The existing policy already allows admin via is_admin(), but let's ensure
-- it's correct and covers the admin role properly
DROP POLICY IF EXISTS "users_read_own_office_assignments" ON public.user_office_assignments;
CREATE POLICY "users_read_own_office_assignments"
ON public.user_office_assignments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin()
  OR public.is_admin()
);

-- ─── 4. Ensure admin can INSERT/UPDATE/DELETE office assignments ──────────
DROP POLICY IF EXISTS "admin_insert_office_assignments" ON public.user_office_assignments;
CREATE POLICY "admin_insert_office_assignments"
ON public.user_office_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "admin_update_office_assignments" ON public.user_office_assignments;
CREATE POLICY "admin_update_office_assignments"
ON public.user_office_assignments
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_admin()
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "admin_delete_office_assignments" ON public.user_office_assignments;
CREATE POLICY "admin_delete_office_assignments"
ON public.user_office_assignments
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_admin()
);
