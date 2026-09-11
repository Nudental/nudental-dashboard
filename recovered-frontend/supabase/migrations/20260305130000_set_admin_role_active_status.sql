-- Migration: Set Admin Role and Active Status for Existing Users
-- Sets all existing user_profiles to role='admin', status='Active', is_approved=true, is_active=true
-- Also fixes the users_update_own_profile RLS policy to allow self-updates

-- 1. Update all existing user_profiles to admin role and Active status
UPDATE public.user_profiles
SET
    role = 'admin'::public.user_role,
    status = 'Active',
    is_approved = true,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP
WHERE id IS NOT NULL;

-- 2. Fix the users_update_own_profile RLS policy
-- The existing policy allows id = auth.uid() OR is_super_admin()
-- This is correct but we ensure it's properly set
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_super_admin())
WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- 3. Ensure the is_active_user function returns true for admin users
-- (already handled by the UPDATE above, but recreate function to be safe)
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND status = 'Active'
        AND is_approved = true
    );
$$;

-- 4. Ensure is_admin_or_above function exists and is correct
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    );
$$;

-- 5. Ensure is_super_admin function exists and is correct
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role = 'super_admin'
    );
$$;
