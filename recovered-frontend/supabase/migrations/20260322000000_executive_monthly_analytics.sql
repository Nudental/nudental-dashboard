-- Migration: Executive Monthly Analytics
-- Timestamp: 20260322000000

CREATE TABLE IF NOT EXISTS public.monthly_executive_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id TEXT NOT NULL CHECK (office_id IN (
    'Nu Dental of Eatontown',
    'Nu Dental of Brick',
    'Nu Dental of Barnegat',
    'Nu Dental of Staten Island'
  )),
  report_month INTEGER NOT NULL CHECK (report_month BETWEEN 1 AND 12),
  report_year INTEGER NOT NULL CHECK (report_year >= 2020),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  -- Clinical
  active_patients INTEGER DEFAULT 0,
  new_patients INTEGER DEFAULT 0,
  attrition_count INTEGER DEFAULT 0,
  tx_diagnosed_value NUMERIC DEFAULT 0,
  tx_accepted_value NUMERIC DEFAULT 0,
  -- Financial A/R
  ar_current NUMERIC DEFAULT 0,
  ar_30_60 NUMERIC DEFAULT 0,
  ar_60_90 NUMERIC DEFAULT 0,
  ar_90_plus NUMERIC DEFAULT 0,
  outstanding_claims_value NUMERIC DEFAULT 0,
  -- Operations
  hygiene_prod NUMERIC DEFAULT 0,
  doctor_prod NUMERIC DEFAULT 0,
  available_chair_hours NUMERIC DEFAULT 0,
  used_chair_hours NUMERIC DEFAULT 0,
  broken_appointments INTEGER DEFAULT 0,
  -- Monthly Finance (negatives allowed)
  production_total NUMERIC DEFAULT 0,
  collections_total NUMERIC DEFAULT 0,
  adjustments_net NUMERIC DEFAULT 0,
  refunds_total NUMERIC DEFAULT 0,
  writeoffs_total NUMERIC DEFAULT 0,
  expenses_total NUMERIC DEFAULT 0,
  payroll_total NUMERIC DEFAULT 0,
  marketing_spend NUMERIC DEFAULT 0,
  lab_fees_total NUMERIC DEFAULT 0,
  supplies_total NUMERIC DEFAULT 0,
  -- Notes & Audit
  notes TEXT,
  data_source TEXT DEFAULT 'manual',
  import_batch_id TEXT,
  UNIQUE (office_id, report_month, report_year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mea_office_month_year ON public.monthly_executive_analytics(office_id, report_month, report_year);
CREATE INDEX IF NOT EXISTS idx_mea_report_year ON public.monthly_executive_analytics(report_year);
CREATE INDEX IF NOT EXISTS idx_mea_created_by ON public.monthly_executive_analytics(created_by_user_id);

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.fn_mea_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mea_updated_at ON public.monthly_executive_analytics;
CREATE TRIGGER trg_mea_updated_at
  BEFORE UPDATE ON public.monthly_executive_analytics
  FOR EACH ROW EXECUTE FUNCTION public.fn_mea_set_updated_at();

-- Enable RLS
ALTER TABLE public.monthly_executive_analytics ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is super_admin or admin
-- NOTE: Using role::text cast to avoid unsafe enum value usage in same transaction
CREATE OR REPLACE FUNCTION public.mea_is_admin_or_super()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND role::text IN ('super_admin', 'admin', 'regional_manager', 'regional_clinical_manager')
      AND is_active = true
  );
$$;

-- Helper function: check if user is office_manager for a given office
CREATE OR REPLACE FUNCTION public.mea_is_office_manager_for(p_office_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.user_office_assignments uoa ON uoa.user_id = up.id
    JOIN public.offices o ON o.id = uoa.office_id
    WHERE up.id = auth.uid()
      AND up.role::text = 'office_manager'
      AND up.is_active = true
      AND o.name = p_office_id
  );
$$;

-- RLS Policies
DROP POLICY IF EXISTS "mea_select" ON public.monthly_executive_analytics;
CREATE POLICY "mea_select"
  ON public.monthly_executive_analytics
  FOR SELECT
  USING (
    public.mea_is_admin_or_super()
    OR public.mea_is_office_manager_for(office_id)
  );

DROP POLICY IF EXISTS "mea_insert" ON public.monthly_executive_analytics;
CREATE POLICY "mea_insert"
  ON public.monthly_executive_analytics
  FOR INSERT
  WITH CHECK (
    public.mea_is_admin_or_super()
    OR public.mea_is_office_manager_for(office_id)
  );

DROP POLICY IF EXISTS "mea_update" ON public.monthly_executive_analytics;
CREATE POLICY "mea_update"
  ON public.monthly_executive_analytics
  FOR UPDATE
  USING (
    public.mea_is_admin_or_super()
    OR public.mea_is_office_manager_for(office_id)
  )
  WITH CHECK (
    public.mea_is_admin_or_super()
    OR public.mea_is_office_manager_for(office_id)
  );

DROP POLICY IF EXISTS "mea_delete" ON public.monthly_executive_analytics;
CREATE POLICY "mea_delete"
  ON public.monthly_executive_analytics
  FOR DELETE
  USING (
    public.mea_is_admin_or_super()
  );
