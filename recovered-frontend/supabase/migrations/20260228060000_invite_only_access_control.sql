-- Migration: Invite-Only Access Control
-- Adds is_approved (boolean) and status (enum: Pending, Active, Deactivated) to user_profiles
-- Updates RLS policies to require status = 'Active' for data access

-- 1. Create status enum type
DO $$ BEGIN
    CREATE TYPE public.user_status AS ENUM ('Pending', 'Active', 'Deactivated');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add is_approved and status columns to user_profiles
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';

-- 3. Set existing active users to Approved + Active status
UPDATE public.user_profiles
SET is_approved = true, status = 'Active'
WHERE is_active = true AND (is_approved IS NULL OR is_approved = false);

-- 4. Set existing inactive users to Deactivated
UPDATE public.user_profiles
SET is_approved = false, status = 'Deactivated'
WHERE is_active = false AND (status IS NULL OR status = 'Pending');

-- 5. Create helper function: check if current user is active
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

-- 6. Update RLS on user_profiles: only Active users can read/write data
-- Super admin can always manage users
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
CREATE POLICY "users_read_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (public.is_active_user() AND public.is_admin_or_above())
);

DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_super_admin())
WITH CHECK (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_manage_users" ON public.user_profiles;
CREATE POLICY "super_admin_manage_users"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- 7. Update RLS on other tables to require Active status (only if tables exist)
-- daily_entries
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_entries') THEN
        DROP POLICY IF EXISTS "active_users_read_daily_entries" ON public.daily_entries;
        CREATE POLICY "active_users_read_daily_entries"
        ON public.daily_entries
        FOR SELECT
        TO authenticated
        USING (public.is_active_user());

        DROP POLICY IF EXISTS "active_users_write_daily_entries" ON public.daily_entries;
        CREATE POLICY "active_users_write_daily_entries"
        ON public.daily_entries
        FOR INSERT
        TO authenticated
        WITH CHECK (public.is_active_user());

        DROP POLICY IF EXISTS "active_users_update_daily_entries" ON public.daily_entries;
        CREATE POLICY "active_users_update_daily_entries"
        ON public.daily_entries
        FOR UPDATE
        TO authenticated
        USING (public.is_active_user())
        WITH CHECK (public.is_active_user());
    END IF;
END $$;

-- offices: active users can read
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'offices') THEN
        DROP POLICY IF EXISTS "active_users_read_offices" ON public.offices;
        CREATE POLICY "active_users_read_offices"
        ON public.offices
        FOR SELECT
        TO authenticated
        USING (public.is_active_user());
    END IF;
END $$;

-- audit_logs: active admins can read
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        DROP POLICY IF EXISTS "active_admins_read_audit_logs" ON public.audit_logs;
        CREATE POLICY "active_admins_read_audit_logs"
        ON public.audit_logs
        FOR SELECT
        TO authenticated
        USING (public.is_active_user() AND public.is_admin_or_above());
    END IF;
END $$;

-- 8. Index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_approved ON public.user_profiles(is_approved);
