-- Error Logging System: structured error logs with severity, stack trace, user context
-- Migration: 20260331170000_error_logs_table.sql

-- 1. Create severity enum
DROP TYPE IF EXISTS public.error_severity CASCADE;
CREATE TYPE public.error_severity AS ENUM ('critical', 'error', 'warning', 'info');

-- 2. Create error_logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity public.error_severity NOT NULL DEFAULT 'error'::public.error_severity,
  message TEXT NOT NULL,
  stack_trace TEXT,
  component_name TEXT,
  page_url TEXT,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,
  office_id UUID,
  environment TEXT DEFAULT 'production',
  browser_info TEXT,
  extra_context JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);

-- 4. Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Admins and super_admins can read all logs
DROP POLICY IF EXISTS "admins_can_read_error_logs" ON public.error_logs;
CREATE POLICY "admins_can_read_error_logs"
ON public.error_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('super_admin', 'admin')
  )
);

-- Any authenticated user can insert error logs (needed for client-side logging)
DROP POLICY IF EXISTS "authenticated_can_insert_error_logs" ON public.error_logs;
CREATE POLICY "authenticated_can_insert_error_logs"
ON public.error_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anonymous inserts for pre-auth errors
DROP POLICY IF EXISTS "anon_can_insert_error_logs" ON public.error_logs;
CREATE POLICY "anon_can_insert_error_logs"
ON public.error_logs
FOR INSERT
TO anon
WITH CHECK (true);

-- Admins can update (mark resolved)
DROP POLICY IF EXISTS "admins_can_update_error_logs" ON public.error_logs;
CREATE POLICY "admins_can_update_error_logs"
ON public.error_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('super_admin', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('super_admin', 'admin')
  )
);
