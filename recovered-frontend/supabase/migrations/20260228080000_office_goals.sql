-- Migration: office_goals table for Monthly Collection Goals system
-- Timestamp: 20260228080000

-- Create office_goals table
CREATE TABLE IF NOT EXISTS public.office_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  month_year text NOT NULL, -- Format: 'YYYY-MM' e.g. '2026-02'
  monthly_target numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(office_id, month_year)
);

-- Enable RLS
ALTER TABLE public.office_goals ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is active
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND status = 'Active'
      AND is_approved = true
  );
$$;

-- RLS Policies for office_goals

-- Super admin and admin can read all goals
DROP POLICY IF EXISTS "office_goals_select" ON public.office_goals;
CREATE POLICY "office_goals_select"
  ON public.office_goals
  FOR SELECT
  USING (
    public.is_active_user()
  );

-- Only super_admin and admin can insert/update goals
DROP POLICY IF EXISTS "office_goals_insert" ON public.office_goals;
CREATE POLICY "office_goals_insert"
  ON public.office_goals
  FOR INSERT
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "office_goals_update" ON public.office_goals;
CREATE POLICY "office_goals_update"
  ON public.office_goals
  FOR UPDATE
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "office_goals_delete" ON public.office_goals;
CREATE POLICY "office_goals_delete"
  ON public.office_goals
  FOR DELETE
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_office_goals_updated_at ON public.office_goals;
CREATE TRIGGER trg_office_goals_updated_at
  BEFORE UPDATE ON public.office_goals
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
