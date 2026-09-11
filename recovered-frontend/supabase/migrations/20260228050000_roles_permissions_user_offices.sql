-- Migration: Roles, Permissions, User-Office Mapping, Email Logs
-- Adds role_permissions table, user_office_assignments (multi-office), email_logs

-- 1. ROLE PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    enabled BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT role_permissions_unique UNIQUE (role, permission)
);

-- 2. USER OFFICE ASSIGNMENTS (multi-office support)
CREATE TABLE IF NOT EXISTS public.user_office_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    all_offices BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_office_unique UNIQUE (user_id, office_id)
);

-- 3. EMAIL LOGS TABLE
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    recipient_name TEXT DEFAULT '',
    email_type TEXT NOT NULL,
    subject TEXT DEFAULT '',
    status TEXT DEFAULT 'sent',
    error_message TEXT DEFAULT '',
    triggered_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_user_office_assignments_user_id ON public.user_office_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_office_assignments_office_id ON public.user_office_assignments(office_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);

-- 5. ENABLE RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_office_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- role_permissions: super_admin manages; authenticated can read
DROP POLICY IF EXISTS "authenticated_read_role_permissions" ON public.role_permissions;
CREATE POLICY "authenticated_read_role_permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "super_admin_manage_role_permissions" ON public.role_permissions;
CREATE POLICY "super_admin_manage_role_permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- user_office_assignments: super_admin manages all; users can read own
DROP POLICY IF EXISTS "users_read_own_office_assignments" ON public.user_office_assignments;
CREATE POLICY "users_read_own_office_assignments"
ON public.user_office_assignments
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_manage_office_assignments" ON public.user_office_assignments;
CREATE POLICY "super_admin_manage_office_assignments"
ON public.user_office_assignments
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- email_logs: super_admin and admin can read; service role inserts
DROP POLICY IF EXISTS "admin_read_email_logs" ON public.email_logs;
CREATE POLICY "admin_read_email_logs"
ON public.email_logs
FOR SELECT
TO authenticated
USING (public.is_admin_or_above());

DROP POLICY IF EXISTS "authenticated_insert_email_logs" ON public.email_logs;
CREATE POLICY "authenticated_insert_email_logs"
ON public.email_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 7. SEED DEFAULT ROLE PERMISSIONS
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES
    ('admin', 'view_reports', true),
    ('admin', 'edit_entries', true),
    ('admin', 'manage_users', false),
    ('admin', 'approve_entries', true),
    ('admin', 'manage_categories', false),
    ('admin', 'view_audit_logs', false),
    ('staff', 'view_reports', false),
    ('staff', 'edit_entries', true),
    ('staff', 'manage_users', false),
    ('staff', 'approve_entries', false),
    ('staff', 'manage_categories', false),
    ('staff', 'view_audit_logs', false),
    ('doctor', 'view_reports', true),
    ('doctor', 'edit_entries', false),
    ('doctor', 'manage_users', false),
    ('doctor', 'approve_entries', false),
    ('doctor', 'manage_categories', false),
    ('doctor', 'view_audit_logs', false)
ON CONFLICT (role, permission) DO NOTHING;
