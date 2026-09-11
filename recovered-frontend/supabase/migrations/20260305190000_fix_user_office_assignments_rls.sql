-- Migration: Fix RLS policies on user_office_assignments to allow Admin role
-- Root cause: super_admin_manage_office_assignments only allows super_admin;
-- Admin role was blocked from inserting/deleting office assignments.

-- Drop existing policies on user_office_assignments and recreate with Admin support
DROP POLICY IF EXISTS "users_read_own_office_assignments" ON public.user_office_assignments;
DROP POLICY IF EXISTS "super_admin_manage_office_assignments" ON public.user_office_assignments;

-- SELECT: users can read their own assignments; super_admin and admin can read all
CREATE POLICY "users_read_own_office_assignments"
ON public.user_office_assignments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin()
  OR public.is_admin()
);

-- INSERT: super_admin and admin can insert office assignments
CREATE POLICY "admin_insert_office_assignments"
ON public.user_office_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_admin()
);

-- UPDATE: super_admin and admin can update office assignments
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

-- DELETE: super_admin and admin can delete office assignments
CREATE POLICY "admin_delete_office_assignments"
ON public.user_office_assignments
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_admin()
);
