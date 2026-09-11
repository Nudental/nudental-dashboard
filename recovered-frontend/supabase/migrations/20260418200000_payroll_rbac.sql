-- Migration: Payroll RBAC enforcement
-- Adds payroll-specific RLS policies so only super_admin can access payroll data
-- Timestamp: 20260418200000

-- ─── Helper: is_super_admin ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
  );
$$;

-- ─── Payroll Access Log Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role text,
  action text NOT NULL,
  filters jsonb,
  accessed_at timestamptz DEFAULT now()
);

-- Only super_admin can read/write payroll_access_log
ALTER TABLE public.payroll_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_access_log_super_admin_only" ON public.payroll_access_log;
CREATE POLICY "payroll_access_log_super_admin_only"
  ON public.payroll_access_log
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─── Payroll Custom Periods Table ─────────────────────────────────────────────
-- Allows super_admin to define custom pay periods if needed
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  year integer NOT NULL,
  period_index integer NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(year, period_index)
);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_periods_super_admin_only" ON public.payroll_periods;
CREATE POLICY "payroll_periods_super_admin_only"
  ON public.payroll_periods
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─── Grant execute on helper function ────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
